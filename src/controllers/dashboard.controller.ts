import { Response } from "express";
import User from "../models/user.model";
import TestSeries from "../models/testSeries.model";
import Test from "../models/test.model";
import Category from "../models/category.model";
import TestAttempt from "../models/testAttempt.model";
import Banner from "../models/banner.model";
import TeacherInfo from "../models/teacherInfo.model";
import SuccessStory from "../models/successStory.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { calculateStreak } from "../utils/streak";
import { getEffectiveWindow, getResultLockUntil, formatTimeLabel, formatTimeOfDay } from "../utils/testSchedule";

export const getStreak = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const completedAttempts = await TestAttempt.find(
      { user: userId, status: "completed" },
      { submittedAt: 1 }
    );
    const streakDays = calculateStreak(completedAttempts.map((a) => a.submittedAt));
    res.status(200).json({ streakDays });
  } catch (error) {
    res.status(500).json({ message: "Failed to load streak", error });
  }
};

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

    const [
      totalTests,
      attempted,
      myActivitiesList,
      completedAttemptsList,
      popularSeries,
      rankAgg,
      activeCategories,
      dbBanners,
      dbTeacherInfo,
      dbSuccessStories,
      allPublishedTests,
    ] = await Promise.all([
      Test.countDocuments({ status: { $ne: "draft" } }),
      TestAttempt.countDocuments({ user: userId }),
      TestAttempt.find({ user: userId, status: "in-progress" }).sort({ updatedAt: -1 }),
      TestAttempt.find({ user: userId, status: "completed" }).sort({ submittedAt: -1 }).limit(10),
      TestSeries.find(seriesFilter).sort({ createdAt: -1 }).limit(10),
      TestAttempt.aggregate([
        { $match: { status: "completed", scorePercent: { $ne: null } } },
        { $group: { _id: "$user", avgScore: { $avg: "$scorePercent" } } },
        { $sort: { avgScore: -1 } },
      ]),
      Category.find({ isActive: true }).sort({ displayOrder: 1 }),
      Banner.find({ isActive: true }).sort({ displayOrder: 1, createdAt: -1 }),
      TeacherInfo.findOne(),
      SuccessStory.find({ isActive: true }).sort({ displayOrder: 1, createdAt: -1 }),
      Test.find({ status: "published" }).populate("series", "title category").limit(10),
    ]);

    const liveTestCounts = await Test.aggregate([
      { $match: { series: { $in: popularSeries.map((s) => s._id) }, status: { $ne: "draft" } } },
      { $group: { _id: "$series", count: { $sum: 1 } } },
    ]);
    const liveTestCountMap = new Map(liveTestCounts.map((c) => [String(c._id), c.count]));

    // Drop in-progress attempts whose underlying Test was deleted — resuming
    // them would 404, so they should never surface as a "Resume Test" card.
    // Also used (full docs, not just _id) to compute each completed
    // attempt's result-lock window below.
    const activityTestIds = [
      ...myActivitiesList.map((a) => a.test),
      ...completedAttemptsList.map((a) => a.test),
    ];
    const activityTests = await Test.find({ _id: { $in: activityTestIds } });
    const existingTestIdSet = new Set(activityTests.map((t) => String(t._id)));
    const activityTestsById = new Map(activityTests.map((t) => [String(t._id), t]));
    const validInProgressAttempts = myActivitiesList.filter((a) =>
      existingTestIdSet.has(String(a.test))
    );

    const rankIndex = rankAgg.findIndex((r) => String(r._id) === String(userId));
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;
    const avgScore = rankIndex >= 0 ? Math.round(rankAgg[rankIndex].avgScore) : 0;

    // Calculate real streak from completed attempt dates
    const allCompletedDates = completedAttemptsList.map((a) => a.submittedAt);
    const streakDays = calculateStreak(allCompletedDates);

    // Default banners if none configured in DB
    const banners = dbBanners.length > 0
      ? dbBanners.map((b) => ({
          id: b._id,
          imageUrl: b.imageUrl,
          title: b.title,
          subtitle: b.subtitle,
          linkUrl: b.linkUrl,
        }))
      : [
          {
            id: "b1",
            imageUrl: "",
            title: "2 MILLION CELEBRATION TEST",
            subtitle: "Rank 1 to 51 Students Cash Prize ₹51,000",
            tag: "By Admin Sir",
          },
          {
            id: "b2",
            imageUrl: "",
            title: "ALL INDIA LIVE MOCK TEST",
            subtitle: "Test your speed & accuracy across India",
            tag: "Speed Special",
          },
          {
            id: "b3",
            imageUrl: "",
            title: "SSC CGL / CHSL TARGET BATCH",
            subtitle: "Complete mock papers with detailed solutions",
            tag: "New Batch",
          },
          {
            id: "b4",
            imageUrl: "",
            title: "RRB NTPC SUPER BOOST TEST",
            subtitle: "90 Mins CBT 1 Practice Papers",
            tag: "Trending",
          },
        ];

    // Teacher / Admin info
    const teacherInfo = {
      name: dbTeacherInfo?.name || "Admin Sir",
      title: dbTeacherInfo?.title || "Meet the Minds Behind Speed Education",
      designation: dbTeacherInfo?.designation || "Founder & Chief Instructor",
      imageUrl: dbTeacherInfo?.imageUrl || "",
      bio: dbTeacherInfo?.bio || "Dedicated to shaping future officers & leaders with Speed Education.",
    };

      // Scheduling is date+optional-time based (see utils/testSchedule.ts), so
      // the live/not-live check can't be expressed as a single Mongo range
      // query once a time-of-day is involved — fetch dated, published
      // candidates and filter the effective window in memory.
      const now = new Date();
      const scheduledPublishedTests = await Test.find({
        status: "published",
        startDate: { $ne: null },
      }).populate("series", "title category").limit(50);

      const activePublishedTests = scheduledPublishedTests
        .filter((t) => {
          const { effectiveStart, effectiveEnd } = getEffectiveWindow(t);
          if (!effectiveStart || effectiveStart > now) return false;
          if (!effectiveEnd || effectiveEnd < now) return false;
          return true;
        })
        .slice(0, 10);

      const liveMocks = activePublishedTests.map((t, idx) => ({
        id: t._id,
        title: t.title || `Live Test - SSC CGL Tier 1`,
        badgeText: `All India Sunday Live Mock-${idx + 1}`,
        totalQuestions: t.totalQuestions || 100,
        durationMinutes: t.durationMinutes || 60,
        totalMarks: t.totalMarks || 200,
        isLive: true,
        liveTimeLabel: t.startTime ? `Live at ${formatTimeOfDay(t.startTime)}` : null,
        category: typeof t.series === "object" && t.series && "category" in t.series ? (t.series as any).category : "SSC",
      }));

      // Trending Exams
      const trendingExams = [
        { id: "cgl", name: "SSC CGL", code: "SSC CGL" },
        { id: "chsl", name: "SSC CHSL", code: "SSC CHSL" },
        { id: "rrb_grad", name: "RRB NTPC Graduate", code: "RRB NTPC" },
        { id: "gd", name: "SSC GD", code: "SSC GD" },
        { id: "alp", name: "RRB ALP", code: "RRB ALP" },
        { id: "rrb_ug", name: "RRB NTPC Under Graduate", code: "RRB NTPC UG" },
        { id: "rpf_si", name: "RPF SI", code: "RPF SI" },
      ];

    // My Activities — in-progress attempts ("Resume Test") and recently
    // completed attempts ("Result"), merged and sorted most-recent-first.
    // Each attempt already stores its own title/category, so this is
    // naturally student-wise and stays correct even if the Test doc is
    // later deleted.
    const recentAttempts = [...validInProgressAttempts, ...completedAttemptsList]
      .sort((a, b) => {
        const aTime = a.status === "completed" ? a.submittedAt : a.updatedAt;
        const bTime = b.status === "completed" ? b.submittedAt : b.updatedAt;
        return new Date(bTime ?? 0).getTime() - new Date(aTime ?? 0).getTime();
      })
      .slice(0, 10);

    const myActivities = recentAttempts.map((a) => {
      const isCompleted = a.status === "completed";
      const test = isCompleted ? activityTestsById.get(String(a.test)) : undefined;
      const lockUntil = test ? getResultLockUntil(test) : null;
      const resultLocked = isCompleted && !!lockUntil && new Date() < lockUntil;
      return {
        attemptId: a._id,
        testId: a.test,
        title: a.title,
        categoryTag: a.category || "General",
        status: a.status,
        totalQuestions: a.totalQuestions,
        questionsCompleted: a.questionsCompleted,
        durationMinutes: 90,
        percent: isCompleted
          ? 100
          : a.totalQuestions > 0
          ? Math.round((a.questionsCompleted / a.totalQuestions) * 100)
          : 0,
        score: isCompleted && !resultLocked ? a.score : null,
        accuracy: isCompleted && !resultLocked ? a.accuracy : null,
        resultLocked,
        resultAvailableAtLabel: resultLocked ? formatTimeLabel(lockUntil as Date) : null,
      };
    });

    // Success Stories
    const successStories = dbSuccessStories.length > 0
      ? dbSuccessStories.map((s) => ({
          id: s._id,
          studentName: s.studentName,
          studentImage: s.studentImage,
          examTag: s.examTag,
          reviewText: s.reviewText,
        }))
      : [
          {
            id: "s1",
            studentName: "MD ASIF",
            studentImage: "",
            examTag: "• SSC CGL 2025 Selected",
            reviewText: "It is so helpful for me Speed Education team. I am really grateful to Admin sir and for my preparation 🎓🎉❤️",
          },
          {
            id: "s2",
            studentName: "PRIYA SHARMA",
            studentImage: "",
            examTag: "• RRB NTPC AIR 14",
            reviewText: "Speed Education live mock tests helped me boost my speed and confidence tremendously before the exam!",
          },
        ];

    res.status(200).json({
      user: { id: user._id, name: user.name, email: user.email },
      stats: {
        totalTests,
        attempted,
        avgScore,
        rank,
        streakDays,
      },
      banners,
      teacherInfo,
      liveMocks,
      trendingExams,
      myActivities,
      continueTest: validInProgressAttempts.length > 0
        ? {
            attemptId: validInProgressAttempts[0]._id,
            testId: validInProgressAttempts[0].test,
            title: validInProgressAttempts[0].title,
            totalQuestions: validInProgressAttempts[0].totalQuestions,
            questionsCompleted: validInProgressAttempts[0].questionsCompleted,
            percent: validInProgressAttempts[0].totalQuestions > 0
              ? Math.round(
                  (validInProgressAttempts[0].questionsCompleted /
                    validInProgressAttempts[0].totalQuestions) *
                    100
                )
              : 0,
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
      successStories,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load dashboard", error });
  }
};
