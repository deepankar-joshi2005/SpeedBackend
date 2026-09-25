import { Response } from "express";
import Pyq from "../models/pyq.model";
import User from "../models/user.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { signPath } from "../utils/signedUrl";

export const listPyqsForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [pyqs, user] = await Promise.all([
      Pyq.find({ isActive: true }).sort({
        category: 1,
        examName: 1,
        year: -1,
        displayOrder: 1,
      }),
      User.findById(req.userId, "purchasedPyqIds isCoachingStudent"),
    ]);

    const purchasedSet = new Set((user?.purchasedPyqIds ?? []).map((id) => String(id)));

    res.status(200).json(
      pyqs.map((p) => {
        const isPurchased = purchasedSet.has(String(p._id));
        const isLocked = p.accessType === "paid" && !isPurchased;
        return {
          id: String(p._id),
          title: p.title,
          category: p.category,
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
