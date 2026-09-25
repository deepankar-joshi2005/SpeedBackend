import { Response } from "express";
import SocialMedia from "../models/socialMedia.model";
import { AuthRequest } from "../middleware/auth.middleware";

export const listSocialMediaForStudent = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const links = await SocialMedia.find({ isActive: true }).sort({
      displayOrder: 1,
      createdAt: -1,
    });
    res.status(200).json(
      links.map((l) => ({
        id: String(l._id),
        platform: l.platform,
        label: l.label,
        link: l.link,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch social media links", error });
  }
};
