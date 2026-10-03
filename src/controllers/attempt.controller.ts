import mongoose from "mongoose";
import { Response } from "express";
import Test, { ISubjectSection } from "../models/test.model";
import Question from "../models/question.model";
import TestSeries from "../models/testSeries.model";
import TestAttempt, { ISectionProgress } from "../models/testAttempt.model";
import Notification from "../models/notification.model";
import User from "../models/user.model";
import Purchase from "../models/purchase.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { resolveSeriesPrice } from "../utils/pricing";
import { getEffectiveWindow, getResultLockUntil, formatDateTimeLabel, formatTimeLabel } from "../utils/testSchedule";

const COACHING_ONLY_MESSAGE =
  "This test is only for Coaching Students. Please contact your Coaching Admin for access.";

// A student's clock/network can lag the server's by a few seconds — this
// grace period keeps a save that lands just after a section's deadline from
// being rejected for reasons the student didn't cause.
const SECTION_GRACE_SECONDS = 5;

function orderedSubjectSections(test: InstanceType<typeof Test>): ISubjectSection[] {
  const sections = test.subjectSections;
  if (!test.divideSectionsByTime || test.sectionOrder.length !== sections.length) {
    return sections;
  }
  const byName = new Map(sections.map((s) => [s.name, s]));
  const ordered = test.sectionOrder
    .map((name) => byName.get(name))
    .filter((s): s is ISubjectSection => !!s);
  return ordered.length === sections.length ? ordered : sections;
}

function buildSectionProgress(test: InstanceType<typeof Test>): ISectionProgress[] {
  const sections = orderedSubjectSections(test);
  return sections.map((section, i) => ({
    name: section.name,
    startNo: section.startNo,
    endNo: section.endNo,
    durationSeconds: test.divideSectionsByTime ? (section.durationMinutes as number) * 60 : null,
    status: test.divideSectionsByTime && i === 0 ? "active" : "pending",
    startedAt: test.divideSectionsByTime && i === 0 ? new Date() : null,
    submittedAt: null,
  }));
}

// Fast-forwards a time-divided attempt's section progress past any section
// whose deadline has already passed (e.g. the app was closed mid-section).
// Runs in a loop so it can walk through several lapsed sections at once.
function advanceExpiredSections(
  attempt: InstanceType<typeof TestAttempt>
): { advanced: boolean; completed: boolean } {
  if (!attempt.divideSectionsByTime) return { advanced: false, completed: false };
  let advanced = false;
  while (true) {
    const active = attempt.sectionProgress.find((s) => s.status === "active");
    if (!active || !active.startedAt || active.durationSeconds === null) {
      return { advanced, completed: false };
    }
    const deadline =
      active.startedAt.getTime() + active.durationSeconds * 1000 + SECTION_GRACE_SECONDS * 1000;
    if (Date.now() < deadline) return { advanced, completed: false };

    active.status = "submitted";
    active.submittedAt = new Date();
    advanced = true;

    const next = attempt.sectionProgress.find((s) => s.status === "pending");
    if (!next) {
      attempt.activeSectionName = null;
      return { advanced, completed: true };
    }
    next.status = "active";
    next.startedAt = new Date();
    attempt.activeSectionName = next.name;
  }
}

// Shared grading logic used by both a full "submit everything now" and the
// automatic completion that happens when the last section ends. Grades from
// the attempt's own snapshotted section ranges (sectionProgress) so scoring
// stays consistent with whatever the student actually experienced, falling
// back to the test's live config only for attempts that predate this feature.
async function gradeAndCompleteAttempt(
  attempt: InstanceType<typeof TestAttempt>,
  test: InstanceType<typeof Test>,
  userId: string
) {
  const questions = await Question.find({ test: attempt.test }).sort({ order: 1 });

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let score = 0;
  const subjectTally = new Map<string, { correct: number; total: number }>();

  const sectionDefs: { name: string; startNo: number; endNo: number }[] =
    attempt.sectionProgress.length > 0
      ? attempt.sectionProgress.map((s) => ({ name: s.name, startNo: s.startNo, endNo: s.endNo }))
      : test.subjectSections.map((s) => ({ name: s.name, startNo: s.startNo, endNo: s.endNo }));

  const sectionTally = sectionDefs.map((section) => ({
    name: section.name,
    correct: 0,
    wrong: 0,
    attempted: 0,
    total: 0,
    score: 0,
    timeSpentSeconds: 0,
  }));

  for (const question of questions) {
    const serialNo = question.order + 1;
    const sectionIndex = sectionDefs.findIndex(
      (section) => serialNo >= section.startNo && serialNo <= section.endNo
    );
    const subjectStat = subjectTally.get(question.subject) ?? { correct: 0, total: 0 };
    subjectStat.total += 1;
    if (sectionIndex !== -1) sectionTally[sectionIndex].total += 1;

    const answer = attempt.answers.find((a) => String(a.question) === String(question._id));
    if (sectionIndex !== -1) {
      const answerTime = answer?.timeSpentSeconds;
      sectionTally[sectionIndex].timeSpentSeconds += Number.isFinite(answerTime)
        ? (answerTime as number)
        : 0;
    }
    const questionMarks = question.marks ?? test.totalMarks / test.totalQuestions;
    if (!answer || answer.selectedOption === null) {
      skippedCount += 1;
    } else if (answer.selectedOption === question.correctOptionIndex) {
      correctCount += 1;
      score += questionMarks;
      answer.isCorrect = true;
      subjectStat.correct += 1;
      if (sectionIndex !== -1) {
        sectionTally[sectionIndex].correct += 1;
        sectionTally[sectionIndex].attempted += 1;
        sectionTally[sectionIndex].score += questionMarks;
      }
    } else {
      wrongCount += 1;
      if (sectionIndex !== -1) {
        sectionTally[sectionIndex].wrong += 1;
        sectionTally[sectionIndex].attempted += 1;
      }
      if (test.negativeMarkingEnabled) {
        const negMarks = question.negativeMarks ?? test.negativeMarks;
        score -= negMarks;
        if (sectionIndex !== -1) sectionTally[sectionIndex].score -= negMarks;
      }
      answer.isCorrect = false;
    }

    subjectTally.set(question.subject, subjectStat);
  }

  sectionTally.forEach((s) => {
    s.score = Math.round(s.score * 100) / 100;
  });
  score = Math.round(score * 100) / 100;
  const scorePercent = Math.max(0, Math.round((score / test.totalMarks) * 100));
  const accuracy =
    correctCount + wrongCount > 0
      ? Math.round((correctCount / (correctCount + wrongCount)) * 100)
      : 0;

  attempt.status = "completed";
  attempt.submittedAt = new Date();
  attempt.timeTakenSeconds = Math.round(
    (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000
  );
  attempt.score = score;
  attempt.scorePercent = scorePercent;
  attempt.correctCount = correctCount;
  attempt.wrongCount = wrongCount;
  attempt.skippedCount = skippedCount;
  attempt.accuracy = accuracy;
  attempt.questionsCompleted = correctCount + wrongCount;
  attempt.subjectBreakdown = Array.from(subjectTally.entries()).map(([subject, stat]) => ({
    subject,
    correct: stat.correct,
    total: stat.total,
  }));
  attempt.sectionBreakdown = sectionTally;
  attempt.activeSectionName = null;

  const completedAttempts = await TestAttempt.find({
    test: attempt.test,
    status: "completed",
  });

  // A user may have multiple completed attempts (reattempts) — rank this
  // attempt against every other user's best score, not each raw attempt.
  const bestByOtherUser = new Map<string, number>();
  for (const a of completedAttempts) {
    if (String(a.user) === String(userId)) continue;
    const uid = String(a.user);
    const existingBest = bestByOtherUser.get(uid);
    if (existingBest === undefined || (a.score ?? 0) > existingBest) {
      bestByOtherUser.set(uid, a.score ?? 0);
    }
  }
  const otherBestScores = Array.from(bestByOtherUser.values());
  attempt.rank = otherBestScores.filter((s) => s > score).length + 1;
  attempt.totalCandidates = otherBestScores.length + 1;

  await attempt.save();

  await Notification.create({
    user: userId,
    type: "result",
    title: "Test Completed",
    message: `You scored ${scorePercent}% in ${attempt.title} (Rank #${attempt.rank} of ${attempt.totalCandidates}). View the answer key to check your answers.`,
    testId: attempt.test,
    attemptId: attempt._id,
    targetScreen: "solutionReview",
  });

  return buildResultPayload(attempt, test, userId);
}

export const startAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { testId } = req.body as { testId?: string };

    if (!testId) {
      res.status(400).json({ message: "testId is required" });
      return;
    }

    const test = await Test.findById(testId);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }

    const series = await TestSeries.findById(test.series);
    if (!series) {
      res.status(404).json({ message: "Test series not found" });
      return;
    }

    const user = await User.findById(userId);

    if (test.accessLevel === "coachingOnly") {
      if (!user?.isCoachingStudent) {
        res.status(403).json({ code: "COACHING_ONLY", message: COACHING_ONLY_MESSAGE });
        return;
      }
    }

    // ─── STRICT SECURITY CHECK: Paid Test Series Entitlement ────────────────
    if (series.accessType === "paid") {
      const isPurchased =
        user?.purchasedSeries?.some((id) => String(id) === String(series._id)) ||
        (await Purchase.exists({ user: userId, testSeries: series._id, status: "success" }));

      const isFreeDemo = test.isFreeDemo || test.order < (series.freeDemoCount ?? 1);
      const requiredPrice = resolveSeriesPrice(series, !!user?.isCoachingStudent);

      // A coaching student whose series is configured Free-for-Coaching
      // (requiredPrice resolves to 0) gets the same direct access as a free
      // demo — no 403, no payment modal, no gateway ever opens for them.
      if (!isPurchased && !isFreeDemo && requiredPrice > 0) {
        res.status(403).json({
          code: "TEST_SERIES_PAID",
          message: "This test is part of a Paid Test Series. Please purchase the test series to unlock all tests.",
          seriesId: series._id,
          price: requiredPrice,
          isCoachingStudent: user?.isCoachingStudent ?? false,
        });
        return;
      }
    }

    const now = new Date();
    const { effectiveStart, effectiveEnd } = getEffectiveWindow(test);
    if (effectiveStart && now < effectiveStart) {
      res.status(403).json({
        message: `This test is scheduled to start on ${formatDateTimeLabel(effectiveStart)}. Please wait until then.`,
      });
      return;
    }

    if (effectiveEnd && now > effectiveEnd) {
      res.status(403).json({
        message: `This test ended on ${formatDateTimeLabel(effectiveEnd)} and is no longer available.`,
      });
      return;
    }

    let attempt = await TestAttempt.findOne({ user: userId, test: testId, status: "in-progress" });

    if (!attempt && test.maxAttempts > 0) {
      const completedAttempts = await TestAttempt.countDocuments({
        user: userId,
        test: testId,
        status: "completed",
      });
      if (completedAttempts >= test.maxAttempts) {
        res.status(403).json({
          message: `You have used all ${test.maxAttempts} allowed attempt(s) for this test.`,
        });
        return;
      }
    }

    if (!attempt) {
      const sectionProgress = buildSectionProgress(test);
      attempt = await TestAttempt.create({
        user: userId,
        test: testId,
        title: test.title,
        category: series.category,
        totalQuestions: test.totalQuestions,
        questionsCompleted: 0,
        answers: [],
        status: "in-progress",
        startedAt: new Date(),
        divideSectionsByTime: test.divideSectionsByTime,
        sectionProgress,
        activeSectionName: test.divideSectionsByTime ? sectionProgress[0]?.name ?? null : null,
      });
    } else {
      const { advanced, completed } = advanceExpiredSections(attempt);
      if (completed) {
        await gradeAndCompleteAttempt(attempt, test, userId);
      } else if (advanced) {
        await attempt.save();
      }
    }

    const questions = await Question.find({ test: testId }).sort({ order: 1 });

    res.status(200).json({
      attemptId: attempt._id,
      attemptStatus: attempt.status,
      test: {
        id: test._id,
        title: test.title,
        totalQuestions: test.totalQuestions,
        durationMinutes: test.durationMinutes,
        totalMarks: test.totalMarks,
        negativeMarks: test.negativeMarks,
        subjectSections: test.subjectSections,
        divideSectionsByTime: test.divideSectionsByTime,
      },
      startedAt: attempt.startedAt,
      sectionProgress: attempt.sectionProgress,
      activeSectionName: attempt.activeSectionName,
      questions: questions.map((q) => ({
        id: q._id,
        subject: q.subject,
        text: q.text,
        textHindi: q.textHindi || null,
        image: q.image || null,
        options: q.options,
        optionsHindi: q.optionsHindi && q.optionsHindi.length === 4 ? q.optionsHindi : null,
        optionImages: q.optionImages && q.optionImages.length === 4 ? q.optionImages : null,
        order: q.order,
      })),
      answers: attempt.answers.map((a) => ({
        questionId: a.question,
        selectedOption: a.selectedOption,
        markedForReview: a.markedForReview,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to start test", error });
  }
};

export const saveAnswer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { attemptId } = req.params;
    const { questionId, selectedOption, markedForReview, timeSpentSeconds } = req.body as {
      questionId?: string;
      selectedOption?: number | null;
      markedForReview?: boolean;
      timeSpentSeconds?: number;
    };

    if (!questionId) {
      res.status(400).json({ message: "questionId is required" });
      return;
    }

    const attempt = await TestAttempt.findOne({ _id: attemptId, user: userId });
    if (!attempt) {
      res.status(404).json({ message: "Attempt not found" });
      return;
    }

    if (attempt.status === "in-progress" && attempt.divideSectionsByTime) {
      const test = await Test.findById(attempt.test);
      const { advanced, completed } = advanceExpiredSections(attempt);
      if (test && completed) {
        await gradeAndCompleteAttempt(attempt, test, userId);
      } else if (advanced) {
        await attempt.save();
      }
    }

    if (attempt.status !== "in-progress") {
      res.status(400).json({ message: "This test has already been submitted" });
      return;
    }

    if (attempt.divideSectionsByTime && attempt.sectionProgress.length > 0) {
      const question = await Question.findById(questionId);
      if (!question) {
        res.status(404).json({ message: "Question not found" });
        return;
      }
      const serialNo = question.order + 1;
      const section = attempt.sectionProgress.find(
        (s) => serialNo >= s.startNo && serialNo <= s.endNo
      );
      if (section && section.name !== attempt.activeSectionName) {
        res.status(400).json({
          message: "This question is in a different section. Submit the current section to continue.",
          code: "SECTION_LOCKED",
          activeSectionName: attempt.activeSectionName,
          sectionProgress: attempt.sectionProgress,
        });
        return;
      }
    }

    const safeTimeSpentSeconds =
      timeSpentSeconds !== undefined && Number.isFinite(timeSpentSeconds)
        ? Math.max(0, timeSpentSeconds)
        : undefined;

    const existing = attempt.answers.find((a) => String(a.question) === questionId);
    if (existing) {
      if (selectedOption !== undefined) existing.selectedOption = selectedOption;
      if (markedForReview !== undefined) existing.markedForReview = markedForReview;
      if (safeTimeSpentSeconds !== undefined) existing.timeSpentSeconds = safeTimeSpentSeconds;
    } else {
      attempt.answers.push({
        question: new mongoose.Types.ObjectId(questionId),
        selectedOption: selectedOption ?? null,
        markedForReview: markedForReview ?? false,
        isCorrect: null,
        timeSpentSeconds: safeTimeSpentSeconds ?? 0,
      });
    }

    attempt.questionsCompleted = attempt.answers.filter((a) => a.selectedOption !== null).length;
    attempt.updatedAt = new Date();
    await attempt.save();

    res.status(200).json({
      questionsCompleted: attempt.questionsCompleted,
      markedForReview: attempt.answers.filter((a) => a.markedForReview).length,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to save answer", error });
  }
};

export const submitAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { attemptId } = req.params;

    const attempt = await TestAttempt.findOne({ _id: attemptId, user: userId });
    if (!attempt) {
      res.status(404).json({ message: "Attempt not found" });
      return;
    }
    if (attempt.status === "completed") {
      res.status(400).json({ message: "This test has already been submitted" });
      return;
    }

    const test = await Test.findById(attempt.test);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }

    // "Submit All": force-finish immediately regardless of section/timer
    // state — mark any not-yet-submitted sections as submitted for the
    // record before grading. Unanswered/unreached questions score as
    // skipped, same as a normal whole-test submit always has.
    const now = new Date();
    attempt.sectionProgress.forEach((section) => {
      if (section.status !== "submitted") {
        section.status = "submitted";
        section.submittedAt = section.submittedAt ?? now;
      }
    });

    res.status(200).json(await gradeAndCompleteAttempt(attempt, test, userId));
  } catch (error) {
    res.status(500).json({ message: "Failed to submit test", error });
  }
};

export const submitSection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { attemptId } = req.params;
    const { name } = req.body as { name?: string };

    if (!name) {
      res.status(400).json({ message: "Section name is required" });
      return;
    }

    const attempt = await TestAttempt.findOne({ _id: attemptId, user: userId });
    if (!attempt) {
      res.status(404).json({ message: "Attempt not found" });
      return;
    }
    if (attempt.status !== "in-progress") {
      res.status(400).json({ message: "This test has already been submitted" });
      return;
    }

    const test = await Test.findById(attempt.test);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }

    const { completed: alreadyCompleted } = advanceExpiredSections(attempt);
    if (alreadyCompleted) {
      const result = await gradeAndCompleteAttempt(attempt, test, userId);
      res.status(200).json({ completed: true, result });
      return;
    }

    const section = attempt.sectionProgress.find((s) => s.name === name);
    if (!section) {
      res.status(404).json({ message: "Section not found on this attempt" });
      return;
    }

    if (attempt.divideSectionsByTime) {
      if (name !== attempt.activeSectionName) {
        res.status(400).json({
          message: "This section is not currently active.",
          code: "SECTION_LOCKED",
          activeSectionName: attempt.activeSectionName,
          sectionProgress: attempt.sectionProgress,
        });
        return;
      }

      section.status = "submitted";
      section.submittedAt = new Date();

      const next = attempt.sectionProgress.find((s) => s.status === "pending");
      if (!next) {
        attempt.activeSectionName = null;
        await attempt.save();
        const result = await gradeAndCompleteAttempt(attempt, test, userId);
        res.status(200).json({ completed: true, result });
        return;
      }

      next.status = "active";
      next.startedAt = new Date();
      attempt.activeSectionName = next.name;
      await attempt.save();
      res.status(200).json({
        completed: false,
        activeSectionName: attempt.activeSectionName,
        sectionProgress: attempt.sectionProgress,
      });
      return;
    }

    // Not time-divided: informational lock only — no ordering/active
    // enforcement, just an idempotent "mark this section done" flag.
    section.status = "submitted";
    section.submittedAt = section.submittedAt ?? new Date();
    await attempt.save();
    res.status(200).json({
      completed: false,
      activeSectionName: null,
      sectionProgress: attempt.sectionProgress,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit section", error });
  }
};

export const getResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { attemptId } = req.params;

    const attempt = await TestAttempt.findOne({ _id: attemptId, user: userId });
    if (!attempt || attempt.status !== "completed") {
      res.status(404).json({ message: "Result not found" });
      return;
    }
    const test = await Test.findById(attempt.test);

    const lockUntil = test ? getResultLockUntil(test) : null;
    if (lockUntil && new Date() < lockUntil) {
      res.status(403).json({
        code: "RESULT_LOCKED",
        message: `Result will be shown at ${formatTimeLabel(lockUntil)}. Your test has been submitted successfully.`,
        availableAt: lockUntil,
      });
      return;
    }

    res.status(200).json(await buildResultPayload(attempt, test, userId));
  } catch (error) {
    res.status(500).json({ message: "Failed to load result", error });
  }
};

export const getSolutions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { attemptId } = req.params;

    const attempt = await TestAttempt.findOne({ _id: attemptId, user: userId });
    if (!attempt) {
      res.status(404).json({ message: "Attempt not found" });
      return;
    }
    const test = await Test.findById(attempt.test);

    const lockUntil = test ? getResultLockUntil(test) : null;
    if (lockUntil && new Date() < lockUntil) {
      res.status(403).json({
        code: "RESULT_LOCKED",
        message: `Solutions will be shown at ${formatTimeLabel(lockUntil)}.`,
        availableAt: lockUntil,
      });
      return;
    }

    const questions = await Question.find({ test: attempt.test }).sort({ order: 1 });

    const answerMap = new Map(attempt.answers.map((a) => [String(a.question), a]));

    res.status(200).json({
      testTitle: test?.title ?? attempt.title,
      subjectSections: test?.subjectSections ?? [],
      questions: questions.map((q, idx) => {
        const answer = answerMap.get(String(q._id));
        return {
          index: idx + 1,
          total: questions.length,
          id: q._id,
          subject: q.subject,
          text: q.text,
          textHindi: q.textHindi || null,
          image: q.image || null,
          options: q.options,
          optionsHindi: q.optionsHindi && q.optionsHindi.length === 4 ? q.optionsHindi : null,
          optionImages: q.optionImages && q.optionImages.length === 4 ? q.optionImages : null,
          correctOptionIndex: q.correctOptionIndex,
          explanation: q.explanation,
          explanationHindi: q.explanationHindi || null,
          explanationImage: q.explanationImage || null,
          selectedOption: answer?.selectedOption ?? null,
          isCorrect: answer?.isCorrect ?? null,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load solutions", error });
  }
};

const didPass = (score: number | null, scorePercent: number | null, passingMarks?: number): boolean => {
  if (passingMarks) return (score ?? 0) >= passingMarks;
  return (scorePercent ?? 0) >= 40;
};

export const getHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const attempts = await TestAttempt.find({ user: userId, status: "completed" })
      .sort({ submittedAt: -1 })
      .limit(30);

    const tests = await Test.find({ _id: { $in: attempts.map((a) => a.test) } });
    const testsMap = new Map(tests.map((t) => [String(t._id), t]));

    res.status(200).json(
      attempts.map((a) => {
        const test = testsMap.get(String(a.test));
        const lockUntil = test ? getResultLockUntil(test) : null;
        const locked = !!lockUntil && new Date() < lockUntil;

        if (locked) {
          return {
            attemptId: a._id,
            title: a.title,
            score: null,
            scorePercent: null,
            rank: null,
            totalCandidates: null,
            passed: null,
            submittedAt: a.submittedAt,
            resultLocked: true,
            resultAvailableAtLabel: formatTimeLabel(lockUntil as Date),
          };
        }

        return {
          attemptId: a._id,
          title: a.title,
          score: a.score,
          scorePercent: a.scorePercent,
          rank: a.rank,
          totalCandidates: a.totalCandidates,
          passed: didPass(a.score, a.scorePercent, test?.passingMarks),
          submittedAt: a.submittedAt,
          resultLocked: false,
          resultAvailableAtLabel: null,
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to load test history", error });
  }
};

async function buildResultPayload(
  attempt: InstanceType<typeof TestAttempt>,
  test: InstanceType<typeof Test> | null,
  userId: string
) {
  const totalMarks = test?.totalMarks ?? 100;
  const passingMarks = test?.passingMarks;

  const completedAttempts = await TestAttempt.find({
    test: attempt.test,
    status: "completed",
  });

  const attemptsUsedByUser = completedAttempts.filter(
    (a) => String(a.user) === String(userId)
  ).length;

  // Overall best-score-per-user aggregation (used for the top score and the
  // percentile-vs-score curve on the Comparison tab).
  const bestByOtherUser = new Map<string, number>();
  for (const a of completedAttempts) {
    if (String(a.user) === String(userId)) continue;
    const uid = String(a.user);
    const existingBest = bestByOtherUser.get(uid);
    if (existingBest === undefined || (a.score ?? 0) > existingBest) {
      bestByOtherUser.set(uid, a.score ?? 0);
    }
  }
  const otherBestScores = Array.from(bestByOtherUser.values());
  const myScore = attempt.score ?? 0;
  const allBestScores = [...otherBestScores, myScore].sort((a, b) => a - b);
  const topScore = allBestScores[allBestScores.length - 1] ?? myScore;
  const uniqueScores = Array.from(new Set(allBestScores)).sort((a, b) => a - b);
  const scoreDistribution = uniqueScores.map((s) => {
    const countLEQ = allBestScores.filter((v) => v <= s).length;
    return {
      score: s,
      percentile: Math.round((countLEQ / allBestScores.length) * 1000) / 10,
    };
  });

  // Same best-per-user aggregation, scoped per section, for section rank/top score.
  const sectionBestByOtherUser = new Map<string, Map<string, number>>();
  for (const a of completedAttempts) {
    if (String(a.user) === String(userId)) continue;
    const uid = String(a.user);
    for (const sec of a.sectionBreakdown ?? []) {
      const secMap = sectionBestByOtherUser.get(sec.name) ?? new Map<string, number>();
      const secScore = sec.score ?? 0;
      const prev = secMap.get(uid);
      if (prev === undefined || secScore > prev) secMap.set(uid, secScore);
      sectionBestByOtherUser.set(sec.name, secMap);
    }
  }
  const sectionBreakdown = (attempt.sectionBreakdown ?? []).map((sec) => {
    const others = Array.from(sectionBestByOtherUser.get(sec.name)?.values() ?? []);
    const mySecScore = sec.score ?? 0;
    const secRank = others.filter((v) => v > mySecScore).length + 1;
    const secTopScore = Math.max(mySecScore, ...others);
    return {
      name: sec.name,
      correct: sec.correct,
      wrong: sec.wrong ?? 0,
      attempted: sec.attempted ?? sec.correct + (sec.wrong ?? 0),
      total: sec.total,
      score: mySecScore,
      timeSpentSeconds: sec.timeSpentSeconds,
      rank: secRank,
      topScore: secTopScore,
    };
  });

  const canReattempt = !test || test.maxAttempts === 0 || attemptsUsedByUser < test.maxAttempts;

  return {
    attemptId: attempt._id,
    testId: attempt.test,
    title: attempt.title,
    score: attempt.score,
    totalMarks,
    scorePercent: attempt.scorePercent,
    passed: didPass(attempt.score, attempt.scorePercent, passingMarks),
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    skippedCount: attempt.skippedCount,
    accuracy: attempt.accuracy,
    timeTakenSeconds: attempt.timeTakenSeconds,
    rank: attempt.rank,
    totalCandidates: attempt.totalCandidates,
    topScore,
    canReattempt,
    subjectBreakdown: attempt.subjectBreakdown,
    sectionBreakdown,
    scoreDistribution,
  };
}
