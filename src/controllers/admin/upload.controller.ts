import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { PYQ_ORIGINALS_DIR, EBOOK_ORIGINALS_DIR } from "../../middleware/upload.middleware";
import { optimizePdfInPlace } from "../../utils/pdfOptimize";

export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ message: "No file was uploaded" });
    return;
  }
  res.status(201).json({ url: `/uploads/${file.filename}` });
};

export const uploadPyqFile = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ message: "No PDF file was uploaded" });
    return;
  }
  res.status(201).json({
    url: `/uploads/pyq/${file.filename}`,
    fileName: file.originalname,
    fileSize: file.size,
  });
  // Compression can take minutes on large scanned PDFs — never let it block
  // the upload response. The file is already usable as-is at file.path.
  optimizePdfInPlace(file.path, PYQ_ORIGINALS_DIR).catch((error) => {
    console.warn("[upload] Background PDF optimization failed:", error);
  });
};

export const uploadEbookFile = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ message: "No PDF file was uploaded" });
    return;
  }
  res.status(201).json({
    url: `/uploads/ebooks/${file.filename}`,
    fileName: file.originalname,
    fileSize: file.size,
  });
  optimizePdfInPlace(file.path, EBOOK_ORIGINALS_DIR).catch((error) => {
    console.warn("[upload] Background PDF optimization failed:", error);
  });
};
