import { Response } from "express";
import Pyq from "../models/pyq.model";
import { AuthRequest } from "../middleware/auth.middleware";

export const listPyqsForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pyqs = await Pyq.find({ isActive: true }).sort({
      category: 1,
      examName: 1,
      year: -1,
      displayOrder: 1,
    });

    res.status(200).json(
      pyqs.map((p) => ({
        id: String(p._id),
        title: p.title,
        category: p.category,
        examName: p.examName,
        year: p.year,
        fileUrl: p.fileUrl,
        fileSize: p.fileSize,
        createdAt: p.createdAt,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch previous year papers", error });
  }
};
