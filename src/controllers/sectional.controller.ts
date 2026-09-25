import { Response } from "express";
import TestSeries from "../models/testSeries.model";
import Test from "../models/test.model";
import TestAttempt from "../models/testAttempt.model";
import User from "../models/user.model";
import { AuthRequest } from "../middleware/auth.middleware";

// Sectional Test reuses the exact same TestSeries/Test/TestAttempt/Purchase
// machinery as regular exam test series — a series with kind:"sectional" is
// one sectional subject (e.g. "Math"), its Tests are the mocks within it
// (Mock 01, Mock 02...). This keeps pricing, purchase, question authoring,
// attempt-taking and results identical to the proven test-series flow.

export const getSectionalCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const userDoc = await User.findById(userId, "purchasedSeries");
    const purchasedSeriesIds = new Set(
      (userDoc?.purchasedSeries || []).map((id) => String(id))
    );

    const seriesList = await TestSeries.find({
      kind: "sectional",
      isAvailable: true,
      status: { $ne: "draft" },
    }).sort({ title: 1 });

    const seriesIds = seriesList.map((s) => s._id);
    const tests = await Test.find({ series: { $in: seriesIds }, status: { $ne: "draft" } });

    const testCountBySeries = new Map<string, number>();
    const questionCountBySeries = new Map<string, number>();
    for (const t of tests) {
      const key = String(t.series);
      testCountBySeries.set(key, (testCountBySeries.get(key) ?? 0) + 1);
      questionCountBySeries.set(key, (questionCountBySeries.get(key) ?? 0) + t.totalQuestions);
    }

    const summary = seriesList.map((series) => {
      const seriesKey = String(series._id);
      return {
        seriesId: seriesKey,
        title: series.title,
        category: series.category,
        bannerImage: series.bannerImage,
        totalTests: testCountBySeries.get(seriesKey) ?? series.totalPapers,
        totalQuestions: questionCountBySeries.get(seriesKey) ?? 0,
        isPaid: series.accessType === "paid" || !!series.isPaid,
        price: series.price || 0,
        coachingPrice: series.coachingPrice || 0,
        isPurchased: purchasedSeriesIds.has(seriesKey),
      };
    });

    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: "Failed to load sectional test categories", error });
  }
};

export const getSectionalSeriesTests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { seriesId } = req.params;

    const series = await TestSeries.findOne({ _id: seriesId, kind: "sectional" });
    if (!series) {
      res.status(404).json({ message: "Sectional test category not found" });
      return;
    }

    const userDoc = await User.findById(userId);
    const purchasedSeriesIds = new Set(
      (userDoc?.purchasedSeries || []).map((id) => String(id))
    );

    const tests = await Test.find({ series: series._id, status: { $ne: "draft" } }).sort({
      order: 1,
    });

    const isSeriesPurchased = purchasedSeriesIds.has(String(series._id));
    const isSeriesPaid = series.accessType === "paid" || !!series.isPaid;
    const freeDemoCount = series.freeDemoCount ?? 1;

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
      category: series.category,
      seriesId: String(series._id),
      seriesTitle: series.title,
      bannerImage: series.bannerImage,
      isPaid: isSeriesPaid,
      price: series.price ?? 0,
      coachingPrice: series.coachingPrice ?? 0,
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
    res.status(500).json({ message: "Failed to load sectional tests", error });
  }
};
