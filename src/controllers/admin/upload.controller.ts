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
  const { finalSize } = await optimizePdfInPlace(file.path, PYQ_ORIGINALS_DIR);
  res.status(201).json({
    url: `/uploads/pyq/${file.filename}`,
    fileName: file.originalname,
    fileSize: finalSize,
  });
};

export const uploadEbookFile = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ message: "No PDF file was uploaded" });
    return;
  }
  const { finalSize } = await optimizePdfInPlace(file.path, EBOOK_ORIGINALS_DIR);
  res.status(201).json({
    url: `/uploads/ebooks/${file.filename}`,
    fileName: file.originalname,
    fileSize: finalSize,
  });
};
