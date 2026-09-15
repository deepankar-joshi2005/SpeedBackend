import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";

export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ message: "No file was uploaded" });
    return;
  }
  res.status(201).json({ url: `/uploads/${file.filename}` });
};
