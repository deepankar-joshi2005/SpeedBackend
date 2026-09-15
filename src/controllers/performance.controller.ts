import { Response } from "express";
import TestAttempt from "../models/testAttempt.model";
import { AuthRequest } from "../middleware/auth.middleware";

const masteryLabel = (accuracy: number): string => {
  if (accuracy >= 80) return "Strong";
  if (accuracy >= 60) return "Average";
  return "Weak";
};

export const getPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;

    const attempts = await TestAttempt.find({ user: userId, status: "completed" }).sort({
      submittedAt: 1,
    });

    if (attempts.length === 0) {
      res.status(200).json({
        attempted: 0,
        avgScore: 0,
        bestScore: 0,
        improvement: 0,
        scoreTrend: [],
        subjectMastery: [],
        overallAccuracy: 0,
      });
      return;
    }

    const scores = attempts.map((a) => a.scorePercent ?? 0);
    const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const bestScore = Math.max(...scores);
    const improvement =
      scores.length >= 2 ? scores[scores.length - 1] - scores[scores.length - 2] : 0;
    const scoreTrend = attempts.slice(-8).map((a) => a.scorePercent ?? 0);

    const subjectTally = new Map<string, { correct: number; total: number }>();
    let totalCorrect = 0;
    let totalAnswered = 0;
    for (const attempt of attempts) {
      totalCorrect += attempt.correctCount;
      totalAnswered += attempt.correctCount + attempt.wrongCount;
      for (const s of attempt.subjectBreakdown) {
        const stat = subjectTally.get(s.subject) ?? { correct: 0, total: 0 };
        stat.correct += s.correct;
        stat.total += s.total;
        subjectTally.set(s.subject, stat);
      }
    }

    const subjectMastery = Array.from(subjectTally.entries()).map(([subject, stat]) => {
      const accuracy = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
      return { subject, accuracy, label: masteryLabel(accuracy) };
    });

    const overallAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    res.status(200).json({
      attempted: attempts.length,
      avgScore,
      bestScore,
      improvement,
      scoreTrend,
      subjectMastery,
      overallAccuracy,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load performance", error });
  }
};
