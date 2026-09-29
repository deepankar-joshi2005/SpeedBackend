import { Response } from "express";
import mongoose from "mongoose";
import Question, { DIFFICULTIES, QuestionDifficulty } from "../../models/question.model";
import Test from "../../models/test.model";
import { AuthRequest } from "../../middleware/auth.middleware";
import { parseSpreadsheet } from "../../utils/sheetParser";

async function recalcTestTotals(testId: mongoose.Types.ObjectId | string): Promise<void> {
  const questions = await Question.find({ test: testId });
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks ?? 0), 0);
  await Test.findByIdAndUpdate(testId, {
    totalQuestions: questions.length,
    totalMarks,
  });
}

export const listBank = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, subject, difficulty, unused } = req.query as {
      search?: string;
      subject?: string;
      difficulty?: string;
      unused?: string;
    };

    const filter: Record<string, unknown> = {};
    if (search) filter.text = { $regex: search, $options: "i" };
    if (subject) filter.subject = subject;
    if (difficulty) filter.difficulty = difficulty;
    if (unused === "true") filter.test = null;

    const questions = await Question.find(filter).sort({ createdAt: -1 }).limit(200);
    const withUsage = await Promise.all(
      questions.map(async (q) => {
        const usageCount = await Question.countDocuments({
          bankId: q.bankId,
          test: { $ne: null },
        });
        return { ...q.toObject(), usageCount };
      })
    );

    res.status(200).json(withUsage);
  } catch (error) {
    res.status(500).json({ message: "Failed to load question bank", error });
  }
};

export const getStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [total, active, unused] = await Promise.all([
      Question.countDocuments({}),
      Question.countDocuments({ test: { $ne: null } }),
      Question.countDocuments({ test: null }),
    ]);
    res.status(200).json({ total, active, unused });
  } catch (error) {
    res.status(500).json({ message: "Failed to load question stats", error });
  }
};

export const getQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      res.status(404).json({ message: "Question not found" });
      return;
    }
    res.status(200).json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to load question", error });
  }
};

export const getByTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const questions = await Question.find({ test: req.params.testId }).sort({ order: 1 });
    res.status(200).json(questions);
  } catch (error) {
    res.status(500).json({ message: "Failed to load test questions", error });
  }
};

export const createQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const {
      testId,
      subject,
      topic,
      text,
      textHindi,
      image,
      options,
      optionsHindi,
      optionImages,
      correctOptionIndex,
      explanation,
      explanationHindi,
      explanationImage,
      difficulty,
      marks,
      negativeMarks,
    } = body as {
      testId?: string;
      subject?: string;
      topic?: string;
      text?: string;
      textHindi?: string;
      image?: string;
      options?: string[];
      optionsHindi?: string[];
      optionImages?: (string | null)[];
      correctOptionIndex?: number;
      explanation?: string;
      explanationHindi?: string;
      explanationImage?: string;
      difficulty?: string;
      marks?: number;
      negativeMarks?: number;
    };

    if ((!text || !text.trim()) && !image) {
      res.status(400).json({ message: "Add a question text or a question image" });
      return;
    }
    if (!subject || !subject.trim()) {
      res.status(400).json({ message: "Subject is required" });
      return;
    }
    if (!Array.isArray(options) || options.length !== 4) {
      res.status(400).json({ message: "All four options are required" });
      return;
    }

    const normalizedOptionImages: (string | null)[] =
      Array.isArray(optionImages) && optionImages.length === 4
        ? optionImages.map((img) => img || null)
        : [null, null, null, null];

    if (options.some((o, i) => !o?.trim() && !normalizedOptionImages[i])) {
      res.status(400).json({ message: "Each option needs text, an image, or both" });
      return;
    }
    if (
      correctOptionIndex === undefined ||
      correctOptionIndex < 0 ||
      correctOptionIndex > 3
    ) {
      res.status(400).json({ message: "A correct option must be selected" });
      return;
    }

    if (
      Array.isArray(optionsHindi) &&
      optionsHindi.length > 0 &&
      optionsHindi.length !== 4
    ) {
      res.status(400).json({ message: "Hindi options must have exactly four entries" });
      return;
    }

    const order = testId ? await Question.countDocuments({ test: testId }) : 0;
    const question = await Question.create({
      test: testId || null,
      subject: subject.trim(),
      topic: topic ?? "",
      text: text?.trim() ?? "",
      textHindi: textHindi?.trim() ?? "",
      image: image ?? null,
      options: options.map((o) => o?.trim() ?? ""),
      optionsHindi: optionsHindi ?? [],
      optionImages: normalizedOptionImages.some((img) => img) ? normalizedOptionImages : [],
      correctOptionIndex,
      explanation: explanation ?? "",
      explanationHindi: explanationHindi ?? "",
      explanationImage: explanationImage ?? null,
      difficulty: (difficulty as QuestionDifficulty) ?? "Moderate",
      marks: marks ?? 2,
      negativeMarks: negativeMarks ?? 0.25,
      order,
    });

    if (testId) await recalcTestTotals(testId);

    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to create question", error });
  }
};

export const updateQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowed = [
      "subject",
      "topic",
      "text",
      "textHindi",
      "image",
      "options",
      "optionsHindi",
      "optionImages",
      "correctOptionIndex",
      "explanation",
      "explanationHindi",
      "explanationImage",
      "difficulty",
      "marks",
      "negativeMarks",
      "order",
    ] as const;
    const body = req.body as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    for (const field of allowed) {
      if (body[field] !== undefined) update[field] = body[field];
    }

    const question = await Question.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!question) {
      res.status(404).json({ message: "Question not found" });
      return;
    }
    if (question.test) await recalcTestTotals(question.test);

    res.status(200).json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to update question", error });
  }
};

export const deleteQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) {
      res.status(404).json({ message: "Question not found" });
      return;
    }
    if (question.test) await recalcTestTotals(question.test);

    res.status(200).json({ message: "Question removed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete question", error });
  }
};

export const addToTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId, marks } = req.body as { testId?: string; marks?: number };
    if (!testId) {
      res.status(400).json({ message: "testId is required" });
      return;
    }

    const source = await Question.findById(req.params.id);
    if (!source) {
      res.status(404).json({ message: "Question not found" });
      return;
    }

    const order = await Question.countDocuments({ test: testId });
    const clone = await Question.create({
      test: testId,
      bankId: source.bankId,
      subject: source.subject,
      topic: source.topic,
      text: source.text,
      textHindi: source.textHindi,
      image: source.image,
      options: source.options,
      optionsHindi: source.optionsHindi,
      optionImages: source.optionImages,
      correctOptionIndex: source.correctOptionIndex,
      explanation: source.explanation,
      explanationHindi: source.explanationHindi,
      explanationImage: source.explanationImage,
      difficulty: source.difficulty,
      marks: marks ?? source.marks,
      negativeMarks: source.negativeMarks,
      order,
    });

    await recalcTestTotals(testId);

    res.status(201).json(clone);
  } catch (error) {
    res.status(500).json({ message: "Failed to add question to test", error });
  }
};

export const bulkAddToTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId, questionIds } = req.body as {
      testId?: string;
      questionIds?: string[];
    };

    if (!testId) {
      res.status(400).json({ message: "testId is required" });
      return;
    }
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      res.status(400).json({ message: "questionIds array is required" });
      return;
    }

    let startOrder = await Question.countDocuments({ test: testId });
    const clones = [];

    for (const qId of questionIds) {
      const source = await Question.findById(qId);
      if (!source) continue;

      const clone = {
        test: testId,
        bankId: source.bankId,
        subject: source.subject,
        topic: source.topic,
        text: source.text,
        textHindi: source.textHindi,
        image: source.image,
        options: source.options,
        optionsHindi: source.optionsHindi,
        optionImages: source.optionImages,
        correctOptionIndex: source.correctOptionIndex,
        explanation: source.explanation,
        explanationHindi: source.explanationHindi,
        explanationImage: source.explanationImage,
        difficulty: source.difficulty,
        marks: source.marks,
        negativeMarks: source.negativeMarks,
        order: startOrder++,
      };
      clones.push(clone);
    }

    const created = await Question.insertMany(clones);
    await recalcTestTotals(testId);

    res.status(201).json({
      added: created.length,
      message: `${created.length} question(s) added to the test.`,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to bulk add questions to test", error });
  }
};

const REQUIRED_COLUMNS = [
  "Question",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Correct Answer",
] as const;

export const importQuestions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ message: "No file was uploaded" });
      return;
    }
    const { testId } = req.params;
    const commit = req.query.commit === "true";

    const rows = await parseSpreadsheet(file.buffer, file.originalname, file.mimetype);
    if (rows.length === 0) {
      res.status(400).json({ message: "The uploaded file has no data rows" });
      return;
    }

    const missingColumns = REQUIRED_COLUMNS.filter((col) => !(col in rows[0]));
    if (missingColumns.length > 0) {
      res.status(400).json({
        message: `Missing required column headers: ${missingColumns.join(", ")}`,
      });
      return;
    }

    const errors: { row: number; message: string }[] = [];
    const validDocs: Record<string, unknown>[] = [];
    const optionKeyByLetter: Record<string, "Option A" | "Option B" | "Option C" | "Option D"> = {
      A: "Option A",
      B: "Option B",
      C: "Option C",
      D: "Option D",
    };

    rows.forEach((row, idx) => {
      const rowNumber = idx + 2;
      const question = row["Question"]?.trim();
      const optionA = row["Option A"]?.trim();
      const optionB = row["Option B"]?.trim();
      const optionC = row["Option C"]?.trim();
      const optionD = row["Option D"]?.trim();
      // Accepts plain "B" as well as freeform values like "Option B (मोनाल)" or "(B)"
      // by pulling out the first standalone A/B/C/D letter in the cell.
      const correctAnswerCell = row["Correct Answer"]?.trim().toUpperCase() ?? "";
      const correctAnswerMatch = correctAnswerCell.match(/\b([ABCD])\b/);
      const correctAnswerRaw = correctAnswerMatch?.[1];

      if (!question) {
        errors.push({ row: rowNumber, message: "Missing Question text" });
        return;
      }
      if (!optionA) {
        errors.push({ row: rowNumber, message: "Option A Missing" });
        return;
      }
      if (!optionB) {
        errors.push({ row: rowNumber, message: "Option B Missing" });
        return;
      }
      if (!optionC) {
        errors.push({ row: rowNumber, message: "Option C Missing" });
        return;
      }
      if (!optionD) {
        errors.push({ row: rowNumber, message: "Option D Missing" });
        return;
      }
      if (!correctAnswerRaw || !optionKeyByLetter[correctAnswerRaw]) {
        errors.push({ row: rowNumber, message: "Missing Correct Answer" });
        return;
      }

      const correctOptionIndex = ["A", "B", "C", "D"].indexOf(correctAnswerRaw);
      const marks = Number(row["Marks"]) || 2;

      // Hindi columns are optional. Only store them if the question text and
      // all four options are present — a partial Hindi set would break the
      // student-side language toggle, which expects all-or-nothing.
      const questionHindi = row["Question Hindi"]?.trim() || "";
      const optionAHindi = row["Option A Hindi"]?.trim() || "";
      const optionBHindi = row["Option B Hindi"]?.trim() || "";
      const optionCHindi = row["Option C Hindi"]?.trim() || "";
      const optionDHindi = row["Option D Hindi"]?.trim() || "";
      const hasFullHindiSet =
        !!questionHindi && !!optionAHindi && !!optionBHindi && !!optionCHindi && !!optionDHindi;

      validDocs.push({
        test: testId,
        subject: row["Subject"]?.trim() || "General",
        topic: row["Topic"]?.trim() || "",
        text: question,
        textHindi: hasFullHindiSet ? questionHindi : "",
        options: [optionA, optionB, optionC, optionD],
        optionsHindi: hasFullHindiSet
          ? [optionAHindi, optionBHindi, optionCHindi, optionDHindi]
          : [],
        correctOptionIndex,
        explanation: row["Explanation"]?.trim() || "",
        explanationHindi: row["Explanation Hindi"]?.trim() || "",
        marks,
        negativeMarks: 0.25,
      });
    });

    if (!commit) {
      res.status(200).json({
        found: rows.length,
        valid: validDocs.length,
        errors,
      });
      return;
    }

    const startOrder = await Question.countDocuments({ test: testId });
    const created = await Question.insertMany(
      validDocs.map((doc, i) => ({ ...doc, order: startOrder + i }))
    );
    await recalcTestTotals(String(testId));

    res.status(201).json({
      found: rows.length,
      valid: validDocs.length,
      imported: created.length,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to import questions", error });
  }
};

export const DIFFICULTY_OPTIONS = DIFFICULTIES;
