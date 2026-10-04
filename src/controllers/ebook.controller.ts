import { Response } from "express";
import Ebook from "../models/ebook.model";
import User from "../models/user.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { signPath } from "../utils/signedUrl";

import Category from "../models/category.model";

export const listEbooksForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [ebooks, user, categories] = await Promise.all([
      Ebook.find({ isActive: true }).sort({ category: 1, displayOrder: 1, createdAt: -1 }),
      User.findById(req.userId, "viewedEbookIds purchasedEbookIds downloadedEbookIds isCoachingStudent"),
      Category.find({ isActive: true }),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.name, c.iconImage]));
    const viewedSet = new Set((user?.viewedEbookIds ?? []).map((id) => String(id)));
    const purchasedSet = new Set((user?.purchasedEbookIds ?? []).map((id) => String(id)));
    const downloadedSet = new Set((user?.downloadedEbookIds ?? []).map((id) => String(id)));

    res.status(200).json(
      ebooks.map((e) => {
        const isPurchased = purchasedSet.has(String(e._id));
        const isLocked = e.accessType === "paid" && !isPurchased;
        return {
          id: String(e._id),
          title: e.title,
          category: e.category,
          categoryIcon: categoryMap.get(e.category) || e.coverImage || null,
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
          isDownloaded: downloadedSet.has(String(e._id)),
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

export const markEbookDownloaded = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { downloadedEbookIds: req.params.id },
    });
    res.status(200).json({ message: "Marked as downloaded" });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark e-book as downloaded", error });
  }
};

export const getMyDownloadedEbooks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId, "downloadedEbookIds purchasedEbookIds isCoachingStudent");
    const downloadedIds = user?.downloadedEbookIds ?? [];
    if (downloadedIds.length === 0) {
      res.status(200).json([]);
      return;
    }

    const [ebooks, categories] = await Promise.all([
      Ebook.find({ _id: { $in: downloadedIds } }),
      Category.find({ isActive: true }),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.name, c.iconImage]));
    const purchasedSet = new Set((user?.purchasedEbookIds ?? []).map((id) => String(id)));

    res.status(200).json(
      ebooks.map((e) => {
        const isPurchased = purchasedSet.has(String(e._id));
        const isLocked = e.accessType === "paid" && !isPurchased;
        return {
          id: String(e._id),
          title: e.title,
          category: e.category,
          categoryIcon: categoryMap.get(e.category) || e.coverImage || null,
          author: e.author,
          coverImage: e.coverImage,
          fileUrl: isLocked ? null : signPath(e.fileUrl),
          isLocked,
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to load downloaded e-books", error });
  }
};
