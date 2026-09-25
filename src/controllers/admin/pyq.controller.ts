import { Response } from "express";
import Pyq from "../../models/pyq.model";
import { AuthRequest } from "../../middleware/auth.middleware";
import { notifyAllStudents } from "../notification.controller";

const normalizePyq = (p: any) => ({
  id: String(p._id),
  title: p.title,
  category: p.category,
  examName: p.examName,
  year: p.year,
  fileUrl: p.fileUrl,
  fileSize: p.fileSize,
  displayOrder: p.displayOrder,
  isActive: p.isActive,
  createdAt: p.createdAt,
});

export const listPyqs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, examName } = req.query as { category?: string; examName?: string };
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (examName) filter.examName = examName;

    const pyqs = await Pyq.find(filter).sort({ year: -1, displayOrder: 1, createdAt: -1 });
    res.status(200).json(pyqs.map(normalizePyq));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch PYQ papers", error });
  }
};

export const createPyq = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, category, examName, year, fileUrl, fileSize, displayOrder, isActive } =
      req.body as {
        title?: string;
        category?: string;
        examName?: string;
        year?: number;
        fileUrl?: string;
        fileSize?: number;
        displayOrder?: number;
        isActive?: boolean;
      };

    if (!title?.trim() || !category?.trim() || !examName?.trim() || !year || !fileUrl) {
      res
        .status(400)
        .json({ message: "Title, category, exam name, year and PDF file are required" });
      return;
    }

    const pyq = await Pyq.create({
      title: title.trim(),
      category: category.trim(),
      examName: examName.trim(),
      year: Number(year),
      fileUrl,
      fileSize: fileSize ? Number(fileSize) : 0,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await notifyAllStudents(
      "New Previous Year Paper Added",
      `${pyq.examName} ${pyq.year} paper is now available in ${pyq.category}.`,
      "system",
      { category: pyq.category, targetScreen: "pyq" }
    );

    res.status(201).json(normalizePyq(pyq));
  } catch (error) {
    res.status(500).json({ message: "Failed to create PYQ paper", error });
  }
};

export const updatePyq = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, category, examName, year, fileUrl, fileSize, displayOrder, isActive } =
      req.body as {
        title?: string;
        category?: string;
        examName?: string;
        year?: number;
        fileUrl?: string;
        fileSize?: number;
        displayOrder?: number;
        isActive?: boolean;
      };

    const pyq = await Pyq.findById(id);
    if (!pyq) {
      res.status(404).json({ message: "PYQ paper not found" });
      return;
    }

    if (title !== undefined) pyq.title = title.trim();
    if (category !== undefined) pyq.category = category.trim();
    if (examName !== undefined) pyq.examName = examName.trim();
    if (year !== undefined) pyq.year = Number(year);
    if (fileUrl !== undefined) pyq.fileUrl = fileUrl;
    if (fileSize !== undefined) pyq.fileSize = Number(fileSize);
    if (displayOrder !== undefined) pyq.displayOrder = Number(displayOrder);
    if (isActive !== undefined) pyq.isActive = Boolean(isActive);

    await pyq.save();
    res.status(200).json(normalizePyq(pyq));
  } catch (error) {
    res.status(500).json({ message: "Failed to update PYQ paper", error });
  }
};

export const setPyqStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isActive } = req.body as { isActive?: boolean };
    const pyq = await Pyq.findByIdAndUpdate(
      req.params.id,
      { isActive: isActive ?? true },
      { new: true }
    );
    if (!pyq) {
      res.status(404).json({ message: "PYQ paper not found" });
      return;
    }
    res.status(200).json(normalizePyq(pyq));
  } catch (error) {
    res.status(500).json({ message: "Failed to update PYQ paper status", error });
  }
};

export const deletePyq = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pyq = await Pyq.findByIdAndDelete(req.params.id);
    if (!pyq) {
      res.status(404).json({ message: "PYQ paper not found" });
      return;
    }
    res.status(200).json({ message: "PYQ paper deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete PYQ paper", error });
  }
};
