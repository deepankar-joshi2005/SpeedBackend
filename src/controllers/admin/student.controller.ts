import { Response } from "express";
import User from "../../models/user.model";
import TestAttempt from "../../models/testAttempt.model";
import Notification from "../../models/notification.model";
import Purchase from "../../models/purchase.model";
import { AuthRequest } from "../../middleware/auth.middleware";

export const listStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query as { search?: string };
    const filter: Record<string, unknown> = { role: "student" };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    const students = await User.find(filter).sort({ createdAt: -1 }).limit(200);
    const withStats = await Promise.all(
      students.map(async (student) => {
        const [attempts, purchases] = await Promise.all([
          TestAttempt.find({ user: student._id, status: "completed" }),
          Purchase.find({ user: student._id, status: "success" }),
        ]);
        const attemptCount = attempts.length;
        const avgScore = attemptCount
          ? Math.round(
              attempts.reduce((sum, a) => sum + (a.scorePercent ?? 0), 0) / attemptCount
            )
          : 0;
        const totalSpent = purchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

        return {
          id: student._id,
          name: student.name,
          email: student.email,
          mobile: student.mobile,
          city: student.city,
          state: student.state,
          isCoachingStudent: student.isCoachingStudent,
          joinedAt: student.createdAt,
          attemptCount,
          avgScore,
          purchasesCount: purchases.length,
          totalSpent,
        };
      })
    );

    res.status(200).json(withStats);
  } catch (error) {
    res.status(500).json({ message: "Failed to load students", error });
  }
};

export const getStudentDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: "student" });
    if (!student) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    const [attempts, purchases] = await Promise.all([
      TestAttempt.find({ user: student._id }).sort({ startedAt: -1 }),
      Purchase.find({ user: student._id, status: "success" }).populate("testSeries", "title accessType price coachingPrice"),
    ]);

    const completed = attempts.filter((a) => a.status === "completed");

    // Aggregate weak-area analysis by section name across every completed attempt.
    const sectionTally = new Map<string, { correct: number; total: number }>();
    for (const attempt of completed) {
      for (const section of attempt.sectionBreakdown) {
        const stat = sectionTally.get(section.name) ?? { correct: 0, total: 0 };
        stat.correct += section.correct;
        stat.total += section.total;
        sectionTally.set(section.name, stat);
      }
    }
    const sectionAnalysis = Array.from(sectionTally.entries())
      .map(([name, stat]) => ({
        name,
        accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
        correct: stat.correct,
        total: stat.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const avgScore = completed.length
      ? Math.round(completed.reduce((sum, a) => sum + (a.scorePercent ?? 0), 0) / completed.length)
      : 0;
    const avgAccuracy = completed.length
      ? Math.round(completed.reduce((sum, a) => sum + (a.accuracy ?? 0), 0) / completed.length)
      : 0;
    const totalSpent = purchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    res.status(200).json({
      id: student._id,
      name: student.name,
      email: student.email,
      mobile: student.mobile,
      city: student.city,
      state: student.state,
      isCoachingStudent: student.isCoachingStudent,
      joinedAt: student.createdAt,
      stats: {
        attemptCount: completed.length,
        avgScore,
        avgAccuracy,
        purchasesCount: purchases.length,
        totalSpent,
      },
      purchasedSeries: purchases.map((p) => ({
        purchaseId: p._id,
        seriesId: (p.testSeries as any)?._id || p.testSeries,
        title: (p.testSeries as any)?.title || "Test Series",
        amountPaid: p.amountPaid,
        purchasedAt: p.createdAt,
      })),
      weakAreas: sectionAnalysis,
      attempts: attempts.map((a) => ({
        attemptId: a._id,
        title: a.title,
        status: a.status,
        score: a.score,
        scorePercent: a.scorePercent,
        timeTakenSeconds: a.timeTakenSeconds,
        submittedAt: a.submittedAt,
        sectionBreakdown: a.sectionBreakdown,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load student", error });
  }
};

export const setCoachingTag = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isCoachingStudent } = req.body as { isCoachingStudent?: boolean };
    if (typeof isCoachingStudent !== "boolean") {
      res.status(400).json({ message: "isCoachingStudent must be true or false" });
      return;
    }

    const student = await User.findOneAndUpdate(
      { _id: req.params.id, role: "student" },
      { isCoachingStudent },
      { new: true }
    );
    if (!student) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    res.status(200).json({ id: student._id, isCoachingStudent: student.isCoachingStudent });
  } catch (error) {
    res.status(500).json({ message: "Failed to update student tag", error });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await User.findOneAndDelete({ _id: req.params.id, role: "student" });
    if (!student) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    await Promise.all([
      TestAttempt.deleteMany({ user: student._id }),
      Notification.deleteMany({ user: student._id }),
    ]);

    res.status(200).json({ message: "Student deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete student", error });
  }
};
