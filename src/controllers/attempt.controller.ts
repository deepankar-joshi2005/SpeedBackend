import mongoose from "mongoose";
import { Response } from "express";
import Test from "../models/test.model";
import Question from "../models/question.model";
import TestSeries from "../models/testSeries.model";
import TestAttempt from "../models/testAttempt.model";
import Notification from "../models/notification.model";
import { AuthRequest } from "../middleware/auth.middleware";

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
      });
    }

    const questions = await Question.find({ test: testId }).sort({ order: 1 });

    res.status(200).json({
      attemptId: attempt._id,
      test: {
        id: test._id,
        title: test.title,
        totalQuestions: test.totalQuestions,
        durationMinutes: test.durationMinutes,
        totalMarks: test.totalMarks,
        negativeMarks: test.negativeMarks,
        subjectSections: test.subjectSections,
      },
      startedAt: attempt.startedAt,
      questions: questions.map((q) => ({
        id: q._id,
        subject: q.subject,
        text: q.text,
        options: q.options,
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
    const { questionId, selectedOption, markedForReview } = req.body as {
      questionId?: string;
      selectedOption?: number | null;
      markedForReview?: boolean;
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
    if (attempt.status !== "in-progress") {
      res.status(400).json({ message: "This test has already been submitted" });
      return;
    }

    const existing = attempt.answers.find((a) => String(a.question) === questionId);
    if (existing) {
      if (selectedOption !== undefined) existing.selectedOption = selectedOption;
      if (markedForReview !== undefined) existing.markedForReview = markedForReview;
    } else {
      attempt.answers.push({
        question: new mongoose.Types.ObjectId(questionId),
        selectedOption: selectedOption ?? null,
        markedForReview: markedForReview ?? false,
        isCorrect: null,
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

    const questions = await Question.find({ test: attempt.test }).sort({ order: 1 });

    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    let score = 0;
    const subjectTally = new Map<string, { correct: number; total: number }>();
    const sectionTally = test.subjectSections.map((section) => ({
      name: section.name,
      correct: 0,
      total: 0,
    }));

    for (const question of questions) {
      const serialNo = question.order + 1;
      const sectionIndex = test.subjectSections.findIndex(
        (section) => serialNo >= section.startNo && serialNo <= section.endNo
      );
      const subjectStat = subjectTally.get(question.subject) ?? { correct: 0, total: 0 };
      subjectStat.total += 1;
      if (sectionIndex !== -1) sectionTally[sectionIndex].total += 1;

      const answer = attempt.answers.find((a) => String(a.question) === String(question._id));
      if (!answer || answer.selectedOption === null) {
        skippedCount += 1;
      } else if (answer.selectedOption === question.correctOptionIndex) {
        correctCount += 1;
        score += question.marks ?? test.totalMarks / test.totalQuestions;
        answer.isCorrect = true;
        subjectStat.correct += 1;
        if (sectionIndex !== -1) sectionTally[sectionIndex].correct += 1;
      } else {
        wrongCount += 1;
        if (test.negativeMarkingEnabled) {
          score -= question.negativeMarks ?? test.negativeMarks;
        }
        answer.isCorrect = false;
      }

      subjectTally.set(question.subject, subjectStat);
    }

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

    res.status(200).json(buildResultPayload(attempt, test.totalMarks, test.passingMarks));
  } catch (error) {
    res.status(500).json({ message: "Failed to submit test", error });
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
    res.status(200).json(buildResultPayload(attempt, test?.totalMarks ?? 100, test?.passingMarks));
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
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          explanation: q.explanation,
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
    const passingMarksMap = new Map(tests.map((t) => [String(t._id), t.passingMarks]));

    res.status(200).json(
      attempts.map((a) => ({
        attemptId: a._id,
        title: a.title,
        score: a.score,
        scorePercent: a.scorePercent,
        rank: a.rank,
        totalCandidates: a.totalCandidates,
        passed: didPass(a.score, a.scorePercent, passingMarksMap.get(String(a.test))),
        submittedAt: a.submittedAt,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to load test history", error });
  }
};

function buildResultPayload(
  attempt: InstanceType<typeof TestAttempt>,
  totalMarks: number,
  passingMarks?: number
) {
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
    subjectBreakdown: attempt.subjectBreakdown,
    sectionBreakdown: attempt.sectionBreakdown,
  };
}
