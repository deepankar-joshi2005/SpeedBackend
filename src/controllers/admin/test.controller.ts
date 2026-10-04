import { Response } from "express";
import Test from "../../models/test.model";
import Question from "../../models/question.model";
import TestSeries from "../../models/testSeries.model";
import TestAttempt from "../../models/testAttempt.model";
import { AuthRequest } from "../../middleware/auth.middleware";
import { notifyAllStudents } from "../notification.controller";

const CONFIG_FIELDS = [
  "title",
  "subject",
  "description",
  "difficulty",
  "totalQuestions",
  "totalMarks",
  "durationMinutes",
  "passingMarks",
  "negativeMarkingEnabled",
  "negativeMarks",
  "maxAttempts",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
  "accessLevel",
  "isFreeDemo",
  "addedToUpcomingMocks",
] as const;

export const listAllTests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query as { search?: string };
    const filter: Record<string, unknown> = {};
    if (search) filter.title = { $regex: search, $options: "i" };

    const tests = await Test.find(filter).sort({ createdAt: -1 }).limit(200);
    const seriesMap = new Map(
      (await TestSeries.find({ _id: { $in: tests.map((t) => t.series) } })).map((s) => [
        String(s._id),
        s.title,
      ])
    );

    const withAttemptCounts = await Promise.all(
      tests.map(async (t) => ({
        id: t._id,
        title: t.title,
        seriesTitle: seriesMap.get(String(t.series)) ?? "",
        status: t.status,
        totalQuestions: t.totalQuestions,
        attemptCount: await TestAttempt.countDocuments({ test: t._id, status: "completed" }),
      }))
    );

    res.status(200).json(withAttemptCounts);
  } catch (error) {
    res.status(500).json({ message: "Failed to load tests", error });
  }
};

export const createTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, series, subject, description, difficulty, status, isFreeDemo } = req.body as Record<
      string,
      any
    >;

    if (!title || !title.trim()) {
      res.status(400).json({ message: "Test name is required" });
      return;
    }
    if (!series) {
      res.status(400).json({ message: "Test series is required" });
      return;
    }

    const seriesDoc = await TestSeries.findById(series);
    const isSeriesFree = seriesDoc?.accessType === "free";
    const finalIsFreeDemo = isSeriesFree ? true : Boolean(isFreeDemo);

    const testStatus = status === "published" ? "published" : "draft";
    const order = await Test.countDocuments({ series });
    const test = await Test.create({
      series,
      title: title.trim(),
      subject: subject ?? "Multiple Subjects",
      description: description ?? "",
      difficulty: difficulty ?? "Mixed",
      status: testStatus,
      order,
      isFreeDemo: finalIsFreeDemo,
    });

    if (testStatus === "published") {
      await notifyAllStudents(
        "New Test Added",
        `${test.title}${seriesDoc ? ` in ${seriesDoc.title}` : ""} is now available. Attempt it now!`,
        "system",
        { testId: test._id, category: seriesDoc?.category, targetScreen: "testInstructions" }
      );
    }

    res.status(201).json(test);
  } catch (error) {
    res.status(500).json({ message: "Failed to create test", error });
  }
};

export const updateTestConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    for (const field of CONFIG_FIELDS) {
      if (body[field] !== undefined) update[field] = body[field];
    }
    if (body.status !== undefined) {
      update.status = body.status;
    }

    const oldTest = await Test.findById(req.params.id);
    if (!oldTest) {
      res.status(404).json({ message: "Test not found" });
      return;
    }

    if (body.durationMinutes !== undefined && oldTest.divideSectionsByTime) {
      const sumMinutes = oldTest.subjectSections.reduce(
        (sum, section) => sum + (section.durationMinutes || 0),
        0
      );
      if (Number(body.durationMinutes) !== sumMinutes) {
        res.status(400).json({
          message: `Cannot change total duration to ${body.durationMinutes} minute(s) — the sections are configured to add up to ${sumMinutes} minute(s). Update the section durations on the Subject Sections screen first.`,
        });
        return;
      }
    }

    const seriesDoc = await TestSeries.findById(oldTest.series);
    if (seriesDoc?.accessType === "free") {
      update.isFreeDemo = true;
    }

    const test = await Test.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }

    if (oldTest?.status !== "published" && test.status === "published") {
      await notifyAllStudents(
        "New Test Added",
        `${test.title}${seriesDoc ? ` in ${seriesDoc.title}` : ""} is now available. Attempt it now!`,
        "system",
        { testId: test._id, category: seriesDoc?.category, targetScreen: "testInstructions" }
      );
    }

    res.status(200).json(test);
  } catch (error) {
    res.status(500).json({ message: "Failed to update test configuration", error });
  }
};

export const getTestDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }
    res.status(200).json(test);
  } catch (error) {
    res.status(500).json({ message: "Failed to load test", error });
  }
};

export const getPublishChecklist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }
    const questionCount = await Question.countDocuments({ test: test._id });

    res.status(200).json({
      testId: test._id,
      title: test.title,
      questionCount,
      checklist: {
        nameAdded: !!test.title,
        questionsAdded: questionCount > 0,
        durationSet: test.durationMinutes > 0,
        marksConfigured: test.totalMarks > 0,
        negativeMarkingConfigured: true,
        allValidated: questionCount > 0,
      },
      summary: {
        questionCount,
        durationMinutes: test.durationMinutes,
        totalMarks: test.totalMarks,
        negativeMarks: test.negativeMarkingEnabled ? test.negativeMarks : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load publish checklist", error });
  }
};

export const publishTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }
    const questionCount = await Question.countDocuments({ test: test._id });
    if (questionCount === 0) {
      res.status(400).json({ message: "Add at least one question before publishing" });
      return;
    }
    test.status = "published";
    await test.save();

    const series = await TestSeries.findById(test.series);
    await notifyAllStudents(
      "New Test Added",
      `${test.title}${series ? ` in ${series.title}` : ""} is now available. Attempt it now!`,
      "system",
      { testId: test._id, category: series?.category, targetScreen: "testInstructions" }
    );

    res.status(200).json(test);
  } catch (error) {
    res.status(500).json({ message: "Failed to publish test", error });
  }
};

export const setSubjectSections = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }

    const { enabled, sections, divideSectionsByTime, sectionOrder } = req.body as {
      enabled?: boolean;
      sections?: {
        name?: string;
        startNo?: number | string;
        endNo?: number | string;
        durationMinutes?: number | string;
      }[];
      divideSectionsByTime?: boolean;
      sectionOrder?: string[];
    };

    if (!enabled) {
      test.subjectSections = [];
      test.divideSectionsByTime = false;
      test.sectionOrder = [];
      await test.save();
      res.status(200).json(test);
      return;
    }

    const totalQuestions = await Question.countDocuments({ test: test._id });
    if (totalQuestions === 0) {
      res.status(400).json({
        message: "Add questions to this test before dividing it by subject.",
      });
      return;
    }

    if (!Array.isArray(sections) || sections.length === 0) {
      res.status(400).json({ message: "Add at least one subject section." });
      return;
    }

    let expectedStart = 1;
    const cleanSections: { name: string; startNo: number; endNo: number; durationMinutes?: number }[] = [];

    for (let i = 0; i < sections.length; i++) {
      const raw = sections[i];
      const position = i + 1;
      const name = raw?.name?.trim();
      const startNo = Number(raw?.startNo);
      const endNo = Number(raw?.endNo);
      const rawDuration = Number(raw?.durationMinutes);

      if (!name) {
        res.status(400).json({ message: `Section ${position}: Subject name is required.` });
        return;
      }
      if (!Number.isInteger(startNo) || !Number.isInteger(endNo)) {
        res.status(400).json({
          message: `Section ${position} (${name}): Question numbers must be whole numbers.`,
        });
        return;
      }
      if (startNo !== expectedStart) {
        res.status(400).json({
          message: `Section ${position} (${name}): Question numbers must continue right after the previous section. This section should start at question ${expectedStart}, not ${startNo}.`,
        });
        return;
      }
      if (endNo < startNo) {
        res.status(400).json({
          message: `Section ${position} (${name}): The last question number cannot come before the first question number.`,
        });
        return;
      }
      if (endNo > totalQuestions) {
        res.status(400).json({
          message: `Section ${position} (${name}): Question number ${endNo} does not exist. This test only has ${totalQuestions} questions.`,
        });
        return;
      }

      cleanSections.push({
        name,
        startNo,
        endNo,
        durationMinutes: Number.isFinite(rawDuration) ? rawDuration : undefined,
      });
      expectedStart = endNo + 1;
    }

    if (expectedStart - 1 !== totalQuestions) {
      res.status(400).json({
        message: `These sections only cover questions 1 to ${expectedStart - 1}, but the test has ${totalQuestions} questions. Add another section to cover questions ${expectedStart} to ${totalQuestions}.`,
      });
      return;
    }

    if (divideSectionsByTime) {
      let sumMinutes = 0;
      for (let i = 0; i < cleanSections.length; i++) {
        const section = cleanSections[i];
        if (!Number.isInteger(section.durationMinutes) || (section.durationMinutes as number) <= 0) {
          res.status(400).json({
            message: `Section ${i + 1} (${section.name}): Enter a duration in minutes for this section.`,
          });
          return;
        }
        sumMinutes += section.durationMinutes as number;
      }

      if (sumMinutes !== test.durationMinutes) {
        const diff = test.durationMinutes - sumMinutes;
        res.status(400).json({
          message: `Section durations add up to ${sumMinutes} minute(s), but this test's total duration is ${test.durationMinutes} minute(s). ${
            diff > 0
              ? `Add ${diff} more minute(s) to the sections.`
              : `Remove ${-diff} minute(s) from the sections.`
          }`,
        });
        return;
      }

      const names = cleanSections.map((s) => s.name);
      const validOrder =
        Array.isArray(sectionOrder) &&
        sectionOrder.length === names.length &&
        names.every((n) => sectionOrder.includes(n)) &&
        new Set(sectionOrder).size === sectionOrder.length;

      if (!validOrder) {
        res.status(400).json({
          message: "Choose the order in which students will see the sections.",
        });
        return;
      }
    }

    test.subjectSections = cleanSections;
    test.divideSectionsByTime = !!divideSectionsByTime;
    test.sectionOrder = divideSectionsByTime ? (sectionOrder as string[]) : [];
    await test.save();
    res.status(200).json(test);
  } catch (error) {
    res.status(500).json({ message: "Failed to save subject sections", error });
  }
};

export const deleteTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const test = await Test.findByIdAndDelete(req.params.id);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }
    await Question.deleteMany({ test: test._id });
    res.status(200).json({ message: "Test deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete test", error });
  }
};
