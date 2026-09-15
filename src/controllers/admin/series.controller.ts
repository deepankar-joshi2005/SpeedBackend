import { Response } from "express";
import TestSeries from "../../models/testSeries.model";
import Test from "../../models/test.model";
import Question from "../../models/question.model";
import TestAttempt from "../../models/testAttempt.model";
import { AuthRequest } from "../../middleware/auth.middleware";
import { notifyAllStudents } from "../notification.controller";

const ALLOWED_FIELDS = [
  "title",
  "category",
  "examTarget",
  "description",
  "shortDescription",
  "bannerImage",
  "difficulty",
  "totalPapers",
  "validityMonths",
  "startDate",
  "endDate",
  "accessType",
  "price",
  "isPublic",
] as const;

function pickAllowed(body: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }
  return update;
}

async function liveCounts(seriesId: string) {
  const tests = await Test.find({ series: seriesId });
  const testIds = tests.map((t) => t._id);
  const totalQuestions = tests.reduce((sum, t) => sum + t.totalQuestions, 0);
  const studentCount = (await TestAttempt.distinct("user", { test: { $in: testIds } })).length;
  return { testCount: tests.length, totalQuestions, studentCount };
}

export const listSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query as { status?: string; search?: string };
    const filter: Record<string, unknown> = {};
    if (status === "published" || status === "draft") filter.status = status;
    if (search) filter.title = { $regex: search, $options: "i" };

    const seriesList = await TestSeries.find(filter).sort({ createdAt: -1 });
    const [all, published, draft] = await Promise.all([
      TestSeries.countDocuments({}),
      TestSeries.countDocuments({ status: "published" }),
      TestSeries.countDocuments({ status: "draft" }),
    ]);

    const withCounts = await Promise.all(
      seriesList.map(async (s) => {
        const counts = await liveCounts(String(s._id));
        return {
          id: s._id,
          title: s.title,
          category: s.category,
          status: s.status,
          testCount: counts.testCount,
          totalQuestions: counts.totalQuestions,
          studentCount: counts.studentCount,
        };
      })
    );

    res.status(200).json({ series: withCounts, counts: { all, published, draft } });
  } catch (error) {
    res.status(500).json({ message: "Failed to load test series", error });
  }
};

export const getSeriesDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const series = await TestSeries.findById(req.params.id);
    if (!series) {
      res.status(404).json({ message: "Test series not found" });
      return;
    }
    const counts = await liveCounts(String(series._id));
    res.status(200).json({ ...series.toObject(), ...counts });
  } catch (error) {
    res.status(500).json({ message: "Failed to load test series", error });
  }
};

export const createSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, category, examTarget, description, shortDescription, bannerImage, difficulty } =
      req.body as Record<string, string | undefined>;

    if (!title || !title.trim()) {
      res.status(400).json({ message: "Test series name is required" });
      return;
    }
    if (!category) {
      res.status(400).json({ message: "Category is required" });
      return;
    }

    const series = await TestSeries.create({
      title: title.trim(),
      category,
      examTarget: examTarget ?? "",
      description: description ?? "",
      shortDescription: shortDescription ?? "",
      bannerImage: bannerImage ?? null,
      difficulty: difficulty ?? "Mixed",
      status: "draft",
    });

    res.status(201).json(series);
  } catch (error) {
    res.status(500).json({ message: "Failed to create test series", error });
  }
};

export const updateSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const update = pickAllowed(req.body as Record<string, unknown>);
    const series = await TestSeries.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!series) {
      res.status(404).json({ message: "Test series not found" });
      return;
    }
    res.status(200).json(series);
  } catch (error) {
    res.status(500).json({ message: "Failed to update test series", error });
  }
};

export const publishSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const series = await TestSeries.findByIdAndUpdate(
      req.params.id,
      { status: "published", isAvailable: true },
      { new: true }
    );
    if (!series) {
      res.status(404).json({ message: "Test series not found" });
      return;
    }
    await notifyAllStudents(
      "New Test Series Added",
      `${series.title} is now available. Start practicing now!`,
      "system",
      { category: series.category, targetScreen: "testList" }
    );
    res.status(200).json(series);
  } catch (error) {
    res.status(500).json({ message: "Failed to publish test series", error });
  }
};

export const deleteSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const series = await TestSeries.findByIdAndDelete(req.params.id);
    if (!series) {
      res.status(404).json({ message: "Test series not found" });
      return;
    }
    const tests = await Test.find({ series: series._id });
    const testIds = tests.map((t) => t._id);
    await Question.deleteMany({ test: { $in: testIds } });
    await TestAttempt.deleteMany({ test: { $in: testIds } });
    await Test.deleteMany({ series: series._id });
    res.status(200).json({ message: "Test series deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete test series", error });
  }
};

export const duplicateSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const series = await TestSeries.findById(req.params.id);
    if (!series) {
      res.status(404).json({ message: "Test series not found" });
      return;
    }
    const clone = series.toObject();
    delete (clone as { _id?: unknown })._id;
    const created = await TestSeries.create({
      ...clone,
      title: `${series.title} (Copy)`,
      status: "draft",
      createdAt: new Date(),
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Failed to duplicate test series", error });
  }
};

export const getSeriesTests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const series = await TestSeries.findById(req.params.id);
    if (!series) {
      res.status(404).json({ message: "Test series not found" });
      return;
    }
    const tests = await Test.find({ series: series._id }).sort({ order: 1, createdAt: 1 });
    res.status(200).json({
      series: { id: series._id, title: series.title },
      tests: tests.map((t) => ({
        id: t._id,
        title: t.title,
        totalQuestions: t.totalQuestions,
        durationMinutes: t.durationMinutes,
        totalMarks: t.totalMarks,
        status: t.status,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load tests for series", error });
  }
};
