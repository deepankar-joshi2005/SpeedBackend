import { Response } from "express";
import Test from "../models/test.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { getEffectiveWindow, formatTimeOfDay } from "../utils/testSchedule";

// GET /upcoming-mocks — public list for student home screen.
// Fully derived from each Test's own schedule (no separate curated list):
// any published, dated test whose effective start hasn't arrived yet is
// "upcoming". The instant that start passes, it naturally drops out of this
// list and starts satisfying the Live Mocks window instead (dashboard
// controller) — nothing needs to move it, both lists are computed fresh
// against the current time on every request.
export const getUpcomingMocks = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    // A test that already started more than a day ago can never have an
    // effective start still in the future, so this bound keeps the query
    // cheap without risking excluding anything that's genuinely upcoming.
    const candidates = await Test.find({
      status: "published",
      addedToUpcomingMocks: true,
      startDate: { $ne: null, $gte: new Date(now.getTime() - dayMs) },
    }).populate("series", "title category");

    const upcoming = candidates
      .map((t) => ({ test: t, effectiveStart: getEffectiveWindow(t).effectiveStart }))
      .filter((x): x is { test: typeof candidates[number]; effectiveStart: Date } =>
        !!x.effectiveStart && x.effectiveStart > now
      )
      .sort((a, b) => a.effectiveStart.getTime() - b.effectiveStart.getTime())
      .slice(0, 10);

    const result = upcoming.map(({ test: t }) => {
      const series = t.series as unknown as { title?: string; category?: string } | null;
      return {
        id: String(t._id),
        testId: String(t._id),
        seriesTitle: series?.title ?? "",
        testTitle: t.title,
        totalQuestions: t.totalQuestions,
        durationMinutes: t.durationMinutes,
        totalMarks: t.totalMarks,
        category: series?.category ?? "",
        startDate: t.startDate,
        // Date-only — a clock time read off this directly is a timezone
        // artifact (e.g. midnight UTC displays as 5:30 AM IST). Only this
        // label (derived straight from the test's own "HH:mm" startTime, or
        // null if none was set) should ever be shown as a time to students.
        startTimeLabel: t.startTime ? formatTimeOfDay(t.startTime) : null,
      };
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch upcoming mocks", error });
  }
};
