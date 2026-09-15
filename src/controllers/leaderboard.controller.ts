import { Response } from "express";
import Test from "../models/test.model";
import TestAttempt from "../models/testAttempt.model";
import User from "../models/user.model";
import { AuthRequest } from "../middleware/auth.middleware";

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const getLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { testId } = req.params;

    const test = await Test.findById(testId);
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }

    const attempts = await TestAttempt.find({ test: testId, status: "completed" })
      .sort({ score: -1 })
      .populate<{ user: { _id: string; name: string } }>("user", "name");

    // A user may have multiple completed attempts (reattempts) — only their
    // best-scoring attempt should count toward the leaderboard.
    const bestByUser = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) {
      const key = String(a.user._id);
      const existing = bestByUser.get(key);
      if (!existing || (a.score ?? 0) > (existing.score ?? 0)) {
        bestByUser.set(key, a);
      }
    }
    const bestAttempts = Array.from(bestByUser.values()).sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0)
    );

    const entries = bestAttempts.map((a, idx) => ({
      rank: idx + 1,
      userId: String(a.user._id),
      name: a.user.name,
      initials: getInitials(a.user.name),
      score: a.score,
      scorePercent: a.scorePercent,
      isCurrentUser: String(a.user._id) === String(userId),
    }));

    const currentUserEntry = entries.find((e) => e.isCurrentUser) ?? null;
    const percentile = currentUserEntry
      ? Math.round(((entries.length - currentUserEntry.rank) / entries.length) * 1000) / 10
      : null;

    res.status(200).json({
      testTitle: test.title,
      totalMarks: test.totalMarks,
      top: entries.slice(0, 10),
      currentUser: currentUserEntry ? { ...currentUserEntry, percentile } : null,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load leaderboard", error });
  }
};
