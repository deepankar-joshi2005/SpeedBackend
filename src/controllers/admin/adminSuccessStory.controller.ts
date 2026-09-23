import { Response } from "express";
import SuccessStory from "../../models/successStory.model";
import { AuthRequest } from "../../middleware/auth.middleware";

const normalizeStory = (s: any) => ({
  id: String(s._id),
  studentName: s.studentName,
  studentImage: s.studentImage || "",
  examTag: s.examTag,
  reviewText: s.reviewText,
  displayOrder: s.displayOrder,
  isActive: s.isActive,
});

export const getAdminSuccessStories = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stories = await SuccessStory.find().sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json(stories.map(normalizeStory));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch success stories", error });
  }
};

export const createAdminSuccessStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentName, studentImage, examTag, reviewText, displayOrder, isActive } = req.body;
    if (!studentName || !examTag || !reviewText) {
      res.status(400).json({ message: "Student Name, Exam Tag, and Review Text are required" });
      return;
    }
    const story = await SuccessStory.create({
      studentName,
      studentImage: studentImage || "",
      examTag,
      reviewText,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });
    res.status(201).json(normalizeStory(story));
  } catch (error) {
    res.status(500).json({ message: "Failed to create success story", error });
  }
};

export const updateAdminSuccessStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { studentName, studentImage, examTag, reviewText, displayOrder, isActive } = req.body;
    const story = await SuccessStory.findByIdAndUpdate(
      id,
      { studentName, studentImage, examTag, reviewText, displayOrder, isActive },
      { new: true }
    );
    if (!story) {
      res.status(404).json({ message: "Success story not found" });
      return;
    }
    res.status(200).json(normalizeStory(story));
  } catch (error) {
    res.status(500).json({ message: "Failed to update success story", error });
  }
};

export const deleteAdminSuccessStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const story = await SuccessStory.findByIdAndDelete(id);
    if (!story) {
      res.status(404).json({ message: "Success story not found" });
      return;
    }
    res.status(200).json({ message: "Success story deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete success story", error });
  }
};
