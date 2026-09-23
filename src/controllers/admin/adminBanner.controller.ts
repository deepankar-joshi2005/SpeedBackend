import { Response } from "express";
import Banner from "../../models/banner.model";
import { AuthRequest } from "../../middleware/auth.middleware";

const normalizeBanner = (b: any) => ({
  id: String(b._id),
  imageUrl: b.imageUrl,
  title: b.title || "",
  subtitle: b.subtitle || "",
  linkUrl: b.linkUrl || "",
  displayOrder: b.displayOrder,
  isActive: b.isActive,
});

export const getAdminBanners = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const banners = await Banner.find().sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json(banners.map(normalizeBanner));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch banners", error });
  }
};

export const createAdminBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { imageUrl, title, subtitle, linkUrl, displayOrder, isActive } = req.body;
    if (!imageUrl) {
      res.status(400).json({ message: "Image URL is required" });
      return;
    }
    const banner = await Banner.create({
      imageUrl,
      title: title || "",
      subtitle: subtitle || "",
      linkUrl: linkUrl || "",
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });
    res.status(201).json(normalizeBanner(banner));
  } catch (error) {
    res.status(500).json({ message: "Failed to create banner", error });
  }
};

export const updateAdminBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { imageUrl, title, subtitle, linkUrl, displayOrder, isActive } = req.body;
    const banner = await Banner.findByIdAndUpdate(
      id,
      { imageUrl, title, subtitle, linkUrl, displayOrder, isActive },
      { new: true }
    );
    if (!banner) {
      res.status(404).json({ message: "Banner not found" });
      return;
    }
    res.status(200).json(normalizeBanner(banner));
  } catch (error) {
    res.status(500).json({ message: "Failed to update banner", error });
  }
};

export const deleteAdminBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      res.status(404).json({ message: "Banner not found" });
      return;
    }
    res.status(200).json({ message: "Banner deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete banner", error });
  }
};
