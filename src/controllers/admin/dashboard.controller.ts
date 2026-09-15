import { Response } from "express";
import User from "../../models/user.model";
import TestSeries from "../../models/testSeries.model";
import Test from "../../models/test.model";
import Question from "../../models/question.model";
import TestAttempt from "../../models/testAttempt.model";
import { AuthRequest } from "../../middleware/auth.middleware";

export const getAdminDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalStudents,
      totalSeries,
      totalTests,
      totalQuestions,
      todaysAttempts,
      todaysNewStudents,
      recentTests,
    ] = await Promise.all([
      User.countDocuments({ role: "student" }),
      TestSeries.countDocuments({}),
      Test.countDocuments({}),
      Question.countDocuments({}),
      TestAttempt.countDocuments({ startedAt: { $gte: startOfToday } }),
      User.countDocuments({ role: "student", createdAt: { $gte: startOfToday } }),
      Test.find().sort({ createdAt: -1 }).limit(5),
    ]);

    res.status(200).json({
      metrics: {
        totalStudents,
        totalSeries,
        totalTests,
        totalQuestions,
        todaysAttempts,
        todaysNewStudents,
      },
      recentActivity: recentTests.map((t) => ({
        id: t._id,
        title: t.title,
        totalQuestions: t.totalQuestions,
        status: t.status,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load admin dashboard", error });
  }
};
