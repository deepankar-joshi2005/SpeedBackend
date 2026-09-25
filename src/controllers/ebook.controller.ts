import { Response } from "express";
import Ebook from "../models/ebook.model";
import User from "../models/user.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { signPath } from "../utils/signedUrl";

export const listEbooksForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [ebooks, user] = await Promise.all([
      Ebook.find({ isActive: true }).sort({ category: 1, displayOrder: 1, createdAt: -1 }),
      User.findById(req.userId, "viewedEbookIds purchasedEbookIds isCoachingStudent"),
    ]);

    const viewedSet = new Set((user?.viewedEbookIds ?? []).map((id) => String(id)));
    const purchasedSet = new Set((user?.purchasedEbookIds ?? []).map((id) => String(id)));

    res.status(200).json(
      ebooks.map((e) => {
        const isPurchased = purchasedSet.has(String(e._id));
        const isLocked = e.accessType === "paid" && !isPurchased;
        return {
          id: String(e._id),
          title: e.title,
          category: e.category,
          author: e.author,
          description: e.description,
          coverImage: e.coverImage,
          fileUrl: isLocked ? null : signPath(e.fileUrl),
          fileSize: e.fileSize,
          accessType: e.accessType,
          price: e.price,
          coachingPrice: e.coachingPrice,
          isCoachingStudent: !!user?.isCoachingStudent,
          isPurchased,
          isLocked,
          createdAt: e.createdAt,
          isNew: !viewedSet.has(String(e._id)),
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch e-books", error });
  }
};

export const markEbookViewed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { viewedEbookIds: req.params.id },
    });
    res.status(200).json({ message: "Marked as viewed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark e-book as viewed", error });
  }
};
