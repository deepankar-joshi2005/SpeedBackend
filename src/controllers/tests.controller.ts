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
    const userDoc = await mongoose.model("User").findById(userId);
    const purchasedSeriesIds = new Set((userDoc?.purchasedSeries || []).map((id: any) => String(id)));

    const [seriesList, completedByCategory] = await Promise.all([
      TestSeries.find({ isAvailable: true, status: { $ne: "draft" } }),
      TestAttempt.aggregate([
        { $match: { user: userId } },
        { $group: { _id: "$category", questionsCompleted: { $sum: "$questionsCompleted" } } },
      ]),
    ]);

    const seriesIds = seriesList.map((s) => s._id);
    const tests = await Test.find({ series: { $in: seriesIds }, status: { $ne: "draft" } });

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
      {
        seriesId: string;
        totalTests: number;
        totalQuestions: number;
        durationMinutes: number;
        difficulty: string;
        isPaid: boolean;
        price: number;
        coachingPrice: number;
        isPurchased: boolean;
      }
    >();

    for (const series of seriesList) {
      const seriesKey = String(series._id);
      const liveTestCount = testCountBySeries.get(seriesKey) ?? 0;
      const liveQuestionCount = questionCountBySeries.get(seriesKey) ?? 0;
      const displayTests = liveTestCount > 0 ? liveTestCount : series.totalPapers;
      const purchased = purchasedSeriesIds.has(seriesKey);

      const existing = byCategory.get(series.category);
      if (existing) {
        existing.totalTests += displayTests;
        existing.totalQuestions += liveQuestionCount;
        if (purchased) existing.isPurchased = true;
      } else {
        byCategory.set(series.category, {
          seriesId: seriesKey,
          totalTests: displayTests,
          totalQuestions: liveQuestionCount,
          durationMinutes: series.durationMinutes,
          difficulty: series.difficulty,
          isPaid: series ? (series.accessType === "paid" || !!series.isPaid) : false,
          price: series.price || 0,
          coachingPrice: series.coachingPrice || 0,
          isPurchased: purchased,
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
          seriesId: agg.seriesId,
          iconImage: cat.iconImage,
          totalTests: agg.totalTests,
          totalQuestions: agg.totalQuestions,
          durationMinutes: agg.durationMinutes,
          difficulty: agg.difficulty,
          percentCompleted,
          isPaid: agg.isPaid,
          price: agg.price,
          coachingPrice: agg.coachingPrice,
          isPurchased: agg.isPurchased,
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

    const userDoc = await mongoose.model("User").findById(userId);
    const purchasedSeriesIds = new Set((userDoc?.purchasedSeries || []).map((id: any) => String(id)));

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
    const series = seriesList[0];
    const seriesIds = seriesList.map((s) => s._id);
    const tests = await Test.find({
      series: { $in: seriesIds },
      status: { $ne: "draft" },
    }).sort({ order: 1 });

    const isSeriesPurchased = series ? purchasedSeriesIds.has(String(series._id)) : false;
    const isSeriesPaid = series ? (series.accessType === "paid" || !!series.isPaid) : false;
    const freeDemoCount = series?.freeDemoCount ?? 1;

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
      seriesId: series ? String(series._id) : null,
      seriesTitle: series?.title ?? `${category} Mock Tests`,
      bannerImage: series?.bannerImage ?? null,
      isPaid: isSeriesPaid,
      price: series?.price ?? 0,
      coachingPrice: series?.coachingPrice ?? 0,
      isPurchased: isSeriesPurchased,
      isCoachingStudent: !!userDoc?.isCoachingStudent,
      tests: tests.map((t, idx) => {
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

        const isFree = !isSeriesPaid || isSeriesPurchased || idx < freeDemoCount || !!t.isFreeDemo;
        const isLocked = !isFree;

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
          isFreeDemo: idx < freeDemoCount || !!t.isFreeDemo,
          isLocked,
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
