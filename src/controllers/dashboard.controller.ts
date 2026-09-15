import { Response } from "express";
import User from "../models/user.model";
import TestSeries from "../models/testSeries.model";
import Test from "../models/test.model";
import Category from "../models/category.model";
import TestAttempt from "../models/testAttempt.model";
import { AuthRequest } from "../middleware/auth.middleware";

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const seriesFilter: Record<string, unknown> = { isAvailable: true, status: { $ne: "draft" } };
    if (category) {
      seriesFilter.category = category;
    }

    const [totalTests, attempted, continueTest, popularSeries, rankAgg, activeCategories] =
      await Promise.all([
      Test.countDocuments({ status: { $ne: "draft" } }),
      TestAttempt.countDocuments({ user: userId }),
      TestAttempt.findOne({ user: userId, status: "in-progress" }).sort({ updatedAt: -1 }),
      TestSeries.find(seriesFilter).sort({ createdAt: -1 }).limit(10),
      TestAttempt.aggregate([
        { $match: { status: "completed", scorePercent: { $ne: null } } },
        { $group: { _id: "$user", avgScore: { $avg: "$scorePercent" } } },
        { $sort: { avgScore: -1 } },
      ]),
      Category.find({ isActive: true }).sort({ displayOrder: 1 }),
    ]);

    const liveTestCounts = await Test.aggregate([
      { $match: { series: { $in: popularSeries.map((s) => s._id) }, status: { $ne: "draft" } } },
      { $group: { _id: "$series", count: { $sum: 1 } } },
    ]);
    const liveTestCountMap = new Map(liveTestCounts.map((c) => [String(c._id), c.count]));

    const rankIndex = rankAgg.findIndex((r) => String(r._id) === String(userId));
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;
    const avgScore = rankIndex >= 0 ? Math.round(rankAgg[rankIndex].avgScore) : 0;

    res.status(200).json({
      user: { id: user._id, name: user.name, email: user.email },
      stats: {
        totalTests,
        attempted,
        avgScore,
        rank,
      },
      continueTest: continueTest
        ? {
            attemptId: continueTest._id,
            testId: continueTest.test,
            title: continueTest.title,
            totalQuestions: continueTest.totalQuestions,
            questionsCompleted: continueTest.questionsCompleted,
            percent: Math.round(
              (continueTest.questionsCompleted / continueTest.totalQuestions) * 100
            ),
          }
        : null,
      categories: activeCategories.map((c) => ({ name: c.name, iconImage: c.iconImage })),
      popularSeries: popularSeries.map((s) => {
        const liveCount = liveTestCountMap.get(String(s._id)) ?? 0;
        return {
          id: s._id,
          title: s.title,
          category: s.category,
          totalPapers: liveCount > 0 ? liveCount : s.totalPapers,
          unitLabel: s.unitLabel,
          isAvailable: s.isAvailable,
          bannerImage: s.bannerImage,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load dashboard", error });
  }
};
