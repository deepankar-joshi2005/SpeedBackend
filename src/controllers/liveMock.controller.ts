import { Response } from "express";
import Test from "../models/test.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { getEffectiveWindow, formatTimeOfDay } from "../utils/testSchedule";

// GET /live-mocks — returns all currently live tests for the dedicated
// Live Tests page. Uses the exact same live-window computation as the
// liveMocks block in getDashboard so the slider and the list page are
// always consistent. No caching: computed fresh on every request so
// expired tests disappear automatically.
export const getLiveMocks = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    const scheduledPublishedTests = await Test.find({
      status: "published",
      addedToUpcomingMocks: true,
      startDate: {
        $ne: null,
        $gte: new Date(now.getTime() - 2 * dayMs),
        $lte: new Date(now.getTime() + 2 * dayMs),
      },
    }).populate("series", "title category");

    const activeTests = scheduledPublishedTests
      .filter((t) => {
        const { effectiveStart, effectiveEnd } = getEffectiveWindow(t);
        if (!effectiveStart || effectiveStart > now) return false;
        if (effectiveEnd && effectiveEnd < now) return false;
        return true;
      })
      .slice(0, 20);

    const result = activeTests.map((t, idx) => ({
      id: String(t._id),
      title: t.title || `Live Test ${idx + 1}`,
      badgeText: `All India Sunday Live Mock-${idx + 1}`,
      totalQuestions: t.totalQuestions || 100,
      durationMinutes: t.durationMinutes || 60,
      totalMarks: t.totalMarks || 200,
      isLive: true,
      liveTimeLabel: t.startTime ? `Live at ${formatTimeOfDay(t.startTime)}` : null,
      category:
        typeof t.series === "object" && t.series && "category" in t.series
          ? (t.series as any).category
          : "SSC",
    }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch live mocks", error });
  }
};
