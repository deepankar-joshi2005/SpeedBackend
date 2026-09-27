import { Response } from "express";
import UpcomingMock from "../models/upcomingMock.model";
import { AuthRequest } from "../middleware/auth.middleware";

// GET /upcoming-mocks — public list for student home screen
export const getUpcomingMocks = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mocks = await UpcomingMock.find().sort({ startDate: 1 });
    const result = mocks.map((u) => ({
      id: String(u._id),
      testId: String(u.test),
      seriesTitle: u.seriesTitle,
      testTitle: u.testTitle,
      totalQuestions: u.totalQuestions,
      durationMinutes: u.durationMinutes,
      totalMarks: u.totalMarks,
      category: u.category,
      startDate: u.startDate,
    }));
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch upcoming mocks", error });
  }
};
