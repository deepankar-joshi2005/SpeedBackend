import { Response } from "express";
import UpcomingMock from "../../models/upcomingMock.model";
import Test from "../../models/test.model";
import TestSeries from "../../models/testSeries.model";
import { AuthRequest } from "../../middleware/auth.middleware";

const normalizeUpcoming = (u: any) => ({
  id: String(u._id),
  testId: String(u.test?._id ?? u.test),
  seriesTitle: u.seriesTitle || "",
  testTitle: u.testTitle || "",
  totalQuestions: u.totalQuestions,
  durationMinutes: u.durationMinutes,
  totalMarks: u.totalMarks,
  category: u.category || "",
  startDate: u.startDate,
});

// GET /admin/upcoming-mocks — list all upcoming entries
export const getAdminUpcomingMocks = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mocks = await UpcomingMock.find().sort({ startDate: 1 });
    res.status(200).json(mocks.map(normalizeUpcoming));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch upcoming mocks", error });
  }
};

// GET /admin/upcoming-mocks/available-tests — all published tests with their startDate
export const getAvailableTests = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Already-added test IDs
    const existing = await UpcomingMock.find({}, { test: 1 });
    const existingIds = new Set(existing.map((e) => String(e.test)));

    const tests = await Test.find({ status: "published" })
      .populate("series", "title category")
      .sort({ createdAt: -1 });

    const result = tests.map((t) => ({
      id: String(t._id),
      testTitle: t.title,
      seriesTitle: (t.series as any)?.title || "",
      category: (t.series as any)?.category || "",
      totalQuestions: t.totalQuestions,
      durationMinutes: t.durationMinutes,
      totalMarks: t.totalMarks,
      startDate: t.startDate,
      alreadyAdded: existingIds.has(String(t._id)),
    }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch available tests", error });
  }
};

// POST /admin/upcoming-mocks — add a test to upcoming mocks
export const addUpcomingMock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId } = req.body as { testId?: string };
    if (!testId) {
      res.status(400).json({ message: "testId is required" });
      return;
    }

    const test = await Test.findById(testId).populate("series", "title category");
    if (!test) {
      res.status(404).json({ message: "Test not found" });
      return;
    }

    const existing = await UpcomingMock.findOne({ test: testId });
    if (existing) {
      res.status(400).json({ message: "Test is already in upcoming mocks" });
      return;
    }

    if (!test.startDate) {
      res.status(400).json({ message: "Test has no startDate. Please set a start date first." });
      return;
    }

    const mock = await UpcomingMock.create({
      test: test._id,
      seriesTitle: (test.series as any)?.title || "",
      testTitle: test.title,
      totalQuestions: test.totalQuestions,
      durationMinutes: test.durationMinutes,
      totalMarks: test.totalMarks,
      category: (test.series as any)?.category || "",
      startDate: test.startDate,
    });

    res.status(201).json(normalizeUpcoming(mock));
  } catch (error) {
    res.status(500).json({ message: "Failed to add upcoming mock", error });
  }
};

// DELETE /admin/upcoming-mocks/:id
export const deleteUpcomingMock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const mock = await UpcomingMock.findByIdAndDelete(id);
    if (!mock) {
      res.status(404).json({ message: "Upcoming mock not found" });
      return;
    }
    res.status(200).json({ message: "Removed from upcoming mocks" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete upcoming mock", error });
  }
};
