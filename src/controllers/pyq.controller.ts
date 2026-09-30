import { Response } from "express";
import Pyq from "../models/pyq.model";
import User from "../models/user.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { signPath } from "../utils/signedUrl";

import Category from "../models/category.model";

export const listPyqsForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [pyqs, user, categories] = await Promise.all([
      Pyq.find({ isActive: true }).sort({
        category: 1,
        examName: 1,
        year: -1,
        displayOrder: 1,
      }),
      User.findById(req.userId, "purchasedPyqIds isCoachingStudent"),
      Category.find({ isActive: true }),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.name, c.iconImage]));
    const purchasedSet = new Set((user?.purchasedPyqIds ?? []).map((id) => String(id)));

    res.status(200).json(
      pyqs.map((p) => {
        const isPurchased = purchasedSet.has(String(p._id));
        const isLocked = p.accessType === "paid" && !isPurchased;
        return {
          id: String(p._id),
          title: p.title,
          category: p.category,
          categoryIcon: categoryMap.get(p.category) || null,
          examName: p.examName,
          year: p.year,
          fileUrl: isLocked ? null : signPath(p.fileUrl),
          fileSize: p.fileSize,
          accessType: p.accessType,
          price: p.price,
          coachingPrice: p.coachingPrice,
          isCoachingStudent: !!user?.isCoachingStudent,
          isPurchased,
          isLocked,
          createdAt: p.createdAt,
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch previous year papers", error });
  }
};
