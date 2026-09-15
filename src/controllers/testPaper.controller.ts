import { Request, Response } from "express";
import TestPaper from "../models/testPaper.model";

export const getAllTestPapers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const testPapers = await TestPaper.find().sort({ createdAt: -1 });
    res.status(200).json(testPapers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch test papers", error });
  }
};

export const createTestPaper = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, subject, totalMarks } = req.body;
    const testPaper = await TestPaper.create({ title, subject, totalMarks });
    res.status(201).json(testPaper);
  } catch (error) {
    res.status(500).json({ message: "Failed to create test paper", error });
  }
};
