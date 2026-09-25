import { Response } from "express";
import Ebook from "../../models/ebook.model";
import { AuthRequest } from "../../middleware/auth.middleware";
import { notifyAllStudents } from "../notification.controller";

const normalizeEbook = (e: any) => ({
  id: String(e._id),
  title: e.title,
  category: e.category,
  author: e.author,
  description: e.description,
  coverImage: e.coverImage,
  fileUrl: e.fileUrl,
  fileSize: e.fileSize,
  displayOrder: e.displayOrder,
  isActive: e.isActive,
  createdAt: e.createdAt,
});

export const listEbooks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category } = req.query as { category?: string };
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;

    const ebooks = await Ebook.find(filter).sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json(ebooks.map(normalizeEbook));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch e-books", error });
  }
};

export const createEbook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, category, author, description, coverImage, fileUrl, fileSize, displayOrder, isActive } =
      req.body as {
        title?: string;
        category?: string;
        author?: string;
        description?: string;
        coverImage?: string | null;
        fileUrl?: string;
        fileSize?: number;
        displayOrder?: number;
        isActive?: boolean;
      };

    if (!title?.trim() || !category?.trim() || !fileUrl) {
      res.status(400).json({ message: "Title, category and PDF file are required" });
      return;
    }

    const ebook = await Ebook.create({
      title: title.trim(),
      category: category.trim(),
      author: author?.trim() ?? "",
      description: description?.trim() ?? "",
      coverImage: coverImage ?? null,
      fileUrl,
      fileSize: fileSize ? Number(fileSize) : 0,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await notifyAllStudents(
      "New E-Book Added",
      `${ebook.title} is now available in ${ebook.category}.`,
      "system",
      { category: ebook.category, targetScreen: "ebooks" }
    );

    res.status(201).json(normalizeEbook(ebook));
  } catch (error) {
    res.status(500).json({ message: "Failed to create e-book", error });
  }
};

export const updateEbook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, category, author, description, coverImage, fileUrl, fileSize, displayOrder, isActive } =
      req.body as {
        title?: string;
        category?: string;
        author?: string;
        description?: string;
        coverImage?: string | null;
        fileUrl?: string;
        fileSize?: number;
        displayOrder?: number;
        isActive?: boolean;
      };

    const ebook = await Ebook.findById(id);
    if (!ebook) {
      res.status(404).json({ message: "E-book not found" });
      return;
    }

    if (title !== undefined) ebook.title = title.trim();
    if (category !== undefined) ebook.category = category.trim();
    if (author !== undefined) ebook.author = author.trim();
    if (description !== undefined) ebook.description = description.trim();
    if (coverImage !== undefined) ebook.coverImage = coverImage;
    if (fileUrl !== undefined) ebook.fileUrl = fileUrl;
    if (fileSize !== undefined) ebook.fileSize = Number(fileSize);
    if (displayOrder !== undefined) ebook.displayOrder = Number(displayOrder);
    if (isActive !== undefined) ebook.isActive = Boolean(isActive);

    await ebook.save();
    res.status(200).json(normalizeEbook(ebook));
  } catch (error) {
    res.status(500).json({ message: "Failed to update e-book", error });
  }
};

export const setEbookStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isActive } = req.body as { isActive?: boolean };
    const ebook = await Ebook.findByIdAndUpdate(
      req.params.id,
      { isActive: isActive ?? true },
      { new: true }
    );
    if (!ebook) {
      res.status(404).json({ message: "E-book not found" });
      return;
    }
    res.status(200).json(normalizeEbook(ebook));
  } catch (error) {
    res.status(500).json({ message: "Failed to update e-book status", error });
  }
};

export const deleteEbook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ebook = await Ebook.findByIdAndDelete(req.params.id);
    if (!ebook) {
      res.status(404).json({ message: "E-book not found" });
      return;
    }
    res.status(200).json({ message: "E-book deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete e-book", error });
  }
};
