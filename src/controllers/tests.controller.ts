import mongoose from "mongoose";
import { Response } from "express";
import TestSeries from "../models/testSeries.model";
import Category from "../models/category.model";
import Test from "../models/test.model";
import TestAttempt from "../models/testAttempt.model";
import { AuthRequest } from "../middleware/auth.middleware";

export const getTestSeriesSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const [seriesList, completedByCategory] = await Promise.all([
      TestSeries.find({ isAvailable: true, status: { $ne: "draft" } }),
      TestAttempt.aggregate([
        { $match: { user: userId } },
        { $group: { _id: "$category", questionsCompleted: { $sum: "$questionsCompleted" } } },
      ]),
    ]);

    const seriesIds = seriesList.map((s) => s._id);
    const tests = await Test.find({ series: { $in: seriesIds }, status: { $ne: "draft" } });

    // Live counts always come from real Test/Question documents. A series'
    // manually-entered "Total Mock Tests Count" only wins when it's set and
    // no tests have been published yet (e.g. admin wants to show a planned
    // total before adding tests) — otherwise the real, live count is shown.
    const testCountBySeries = new Map<string, number>();
    const questionCountBySeries = new Map<string, number>();
    for (const t of tests) {
      const key = String(t.series);
      testCountBySeries.set(key, (testCountBySeries.get(key) ?? 0) + 1);
      questionCountBySeries.set(key, (questionCountBySeries.get(key) ?? 0) + t.totalQuestions);
    }

    const completedMap = new Map(
      completedByCategory.map((c) => [c._id, c.questionsCompleted as number])
    );

    const byCategory = new Map<
      string,
      { totalTests: number; totalQuestions: number; durationMinutes: number; difficulty: string }
    >();
    for (const series of seriesList) {
      const seriesKey = String(series._id);
      const liveTestCount = testCountBySeries.get(seriesKey) ?? 0;
      const liveQuestionCount = questionCountBySeries.get(seriesKey) ?? 0;
      const displayTests = liveTestCount > 0 ? liveTestCount : series.totalPapers;

      const existing = byCategory.get(series.category);
      if (existing) {
        existing.totalTests += displayTests;
        existing.totalQuestions += liveQuestionCount;
      } else {
        byCategory.set(series.category, {
          totalTests: displayTests,
          totalQuestions: liveQuestionCount,
          durationMinutes: series.durationMinutes,
          difficulty: series.difficulty,
        });
      }
    }

    const activeCategories = await Category.find({ isActive: true }).sort({ displayOrder: 1 });

    const summary = activeCategories
      .filter((cat) => byCategory.has(cat.name))
      .map((cat) => {
        const agg = byCategory.get(cat.name)!;
        const completedQuestions = completedMap.get(cat.name) ?? 0;
        const percentCompleted = agg.totalQuestions
          ? Math.min(100, Math.round((completedQuestions / agg.totalQuestions) * 100))
          : 0;

        return {
          category: cat.name,
          iconImage: cat.iconImage,
          totalTests: agg.totalTests,
          totalQuestions: agg.totalQuestions,
          durationMinutes: agg.durationMinutes,
          difficulty: agg.difficulty,
          percentCompleted,
        };
      });

    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: "Failed to load test series summary", error });
  }
};

export const getTestsByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const category = req.params.category;

    const categoryDoc = await Category.findOne({ name: category, isActive: true });
    if (!categoryDoc) {
      res.status(400).json({ message: "Unknown category" });
      return;
    }

    const seriesList = await TestSeries.find({
      category,
      isAvailable: true,
      status: { $ne: "draft" },
    });
    const seriesIds = seriesList.map((s) => s._id);
    const tests = await Test.find({
      series: { $in: seriesIds },
      status: { $ne: "draft" },
    }).sort({ order: 1 });

    const attempts = await TestAttempt.find({
      user: userId,
      test: { $in: tests.map((t) => t._id) },
    });
    const attemptsByTest = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const key = String(a.test);
      const arr = attemptsByTest.get(key) ?? [];
      arr.push(a);
      attemptsByTest.set(key, arr);
    }

    res.status(200).json({
      category,
      seriesTitle: seriesList[0]?.title ?? `${category} Mock Tests`,
      bannerImage: seriesList[0]?.bannerImage ?? null,
      tests: tests.map((t) => {
        const testAttempts = attemptsByTest.get(String(t._id)) ?? [];
        const inProgress = testAttempts.find((a) => a.status === "in-progress");
        const completed = testAttempts
          .filter((a) => a.status === "completed")
          .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
        const latestCompleted = completed[0];

        let status: "not-attempted" | "in-progress" | "completed" = "not-attempted";
        if (inProgress) status = "in-progress";
        else if (latestCompleted) status = "completed";

        const attemptsUsed = completed.length;
        const canReattempt =
          status === "completed" && (t.maxAttempts === 0 || attemptsUsed < t.maxAttempts);

        return {
          id: t._id,
          title: t.title,
          totalQuestions: t.totalQuestions,
          durationMinutes: t.durationMinutes,
          totalMarks: t.totalMarks,
          difficulty: t.difficulty,
          status,
          attemptId: inProgress?._id ?? latestCompleted?._id ?? null,
          score: latestCompleted?.score ?? null,
          scorePercent: latestCompleted?.scorePercent ?? null,
          maxAttempts: t.maxAttempts,
          attemptsUsed,
          canReattempt,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load tests", error });
  }
};

export const getTestInstructions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
    const test = await Test.findById(testId);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }
    const series = await TestSeries.findById(test.series);

    res.status(200).json({
      id: test._id,
      title: test.title,
      seriesTitle: series?.title ?? "",
      category: series?.category ?? "",
      totalQuestions: test.totalQuestions,
      totalMarks: test.totalMarks,
      durationMinutes: test.durationMinutes,
      negativeMarks: test.negativeMarks,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load test instructions", error });
  }
};
