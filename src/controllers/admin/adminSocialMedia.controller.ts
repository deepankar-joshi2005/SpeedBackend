import { Response } from "express";
import SocialMedia from "../../models/socialMedia.model";
import { AuthRequest } from "../../middleware/auth.middleware";

const normalizeSocialMedia = (s: any) => ({
  id: String(s._id),
  platform: s.platform,
  label: s.label,
  link: s.link,
  displayOrder: s.displayOrder,
  isActive: s.isActive,
});

export const getAdminSocialMedia = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const links = await SocialMedia.find().sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json(links.map(normalizeSocialMedia));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch social media links", error });
  }
};

export const createAdminSocialMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { platform, label, link, displayOrder, isActive } = req.body;
    if (!platform || !label || !link) {
      res.status(400).json({ message: "Platform, label and link are required" });
      return;
    }
    const socialMedia = await SocialMedia.create({
      platform,
      label,
      link,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });
    res.status(201).json(normalizeSocialMedia(socialMedia));
  } catch (error) {
    res.status(500).json({ message: "Failed to create social media link", error });
  }
};

export const updateAdminSocialMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { platform, label, link, displayOrder, isActive } = req.body;
    const socialMedia = await SocialMedia.findByIdAndUpdate(
      id,
      { platform, label, link, displayOrder, isActive },
      { new: true }
    );
    if (!socialMedia) {
      res.status(404).json({ message: "Social media link not found" });
      return;
    }
    res.status(200).json(normalizeSocialMedia(socialMedia));
  } catch (error) {
    res.status(500).json({ message: "Failed to update social media link", error });
  }
};

export const deleteAdminSocialMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const socialMedia = await SocialMedia.findByIdAndDelete(id);
    if (!socialMedia) {
      res.status(404).json({ message: "Social media link not found" });
      return;
    }
    res.status(200).json({ message: "Social media link deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete social media link", error });
  }
};
