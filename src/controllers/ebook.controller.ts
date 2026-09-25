import { Response } from "express";
import Ebook from "../models/ebook.model";
import User from "../models/user.model";
import { AuthRequest } from "../middleware/auth.middleware";

export const listEbooksForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [ebooks, user] = await Promise.all([
      Ebook.find({ isActive: true }).sort({ category: 1, displayOrder: 1, createdAt: -1 }),
      User.findById(req.userId, "viewedEbookIds"),
    ]);

    const viewedSet = new Set((user?.viewedEbookIds ?? []).map((id) => String(id)));

    res.status(200).json(
      ebooks.map((e) => ({
        id: String(e._id),
        title: e.title,
        category: e.category,
        author: e.author,
        description: e.description,
        coverImage: e.coverImage,
        fileUrl: e.fileUrl,
        fileSize: e.fileSize,
        createdAt: e.createdAt,
        isNew: !viewedSet.has(String(e._id)),
      }))
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
