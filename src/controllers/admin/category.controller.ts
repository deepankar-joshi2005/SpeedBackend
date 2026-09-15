import { Response } from "express";
import Category from "../../models/category.model";
import TestSeries from "../../models/testSeries.model";
import Test from "../../models/test.model";
import TestAttempt from "../../models/testAttempt.model";
import { AuthRequest } from "../../middleware/auth.middleware";

async function countsForCategory(name: string) {
  const seriesList = await TestSeries.find({ category: name });
  const seriesIds = seriesList.map((s) => s._id);
  const [testCount, studentCount] = await Promise.all([
    Test.countDocuments({ series: { $in: seriesIds } }),
    TestAttempt.distinct("user", { category: name }).then((u) => u.length),
  ]);
  return { seriesCount: seriesList.length, testCount, studentCount };
}

export const listCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await Category.find().sort({ displayOrder: 1, createdAt: 1 });
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const counts = await countsForCategory(cat.name);
        return {
          id: cat._id,
          name: cat.name,
          description: cat.description,
          iconKey: cat.iconKey,
          iconImage: cat.iconImage,
          bannerImage: cat.bannerImage,
          displayOrder: cat.displayOrder,
          isActive: cat.isActive,
          seriesCount: counts.seriesCount,
          testCount: counts.testCount,
        };
      })
    );
    res.status(200).json(withCounts);
  } catch (error) {
    res.status(500).json({ message: "Failed to load categories", error });
  }
};

export const getCategoryDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const seriesList = await TestSeries.find({ category: category.name }).sort({
      createdAt: -1,
    });
    const seriesWithTestCounts = await Promise.all(
      seriesList.map(async (s) => {
        const testCount = await Test.countDocuments({ series: s._id });
        return {
          id: s._id,
          title: s.title,
          totalTests: testCount,
          totalQuestions: s.totalQuestions,
          status: s.status,
        };
      })
    );

    const counts = await countsForCategory(category.name);

    res.status(200).json({
      id: category._id,
      name: category.name,
      description: category.description,
      iconKey: category.iconKey,
      iconImage: category.iconImage,
      bannerImage: category.bannerImage,
      isActive: category.isActive,
      seriesCount: counts.seriesCount,
      testCount: counts.testCount,
      studentCount: counts.studentCount,
      series: seriesWithTestCounts,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load category", error });
  }
};

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, iconKey, iconImage, bannerImage, displayOrder, isActive } =
      req.body as {
        name?: string;
        description?: string;
        iconKey?: string;
        iconImage?: string;
        bannerImage?: string;
        displayOrder?: number;
        isActive?: boolean;
      };

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Category name is required" });
      return;
    }

    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      res.status(409).json({ message: "A category with this name already exists" });
      return;
    }

    const category = await Category.create({
      name: name.trim(),
      description: description?.trim() ?? "",
      iconKey: iconKey ?? "book-outline",
      iconImage: iconImage ?? null,
      bannerImage: bannerImage ?? null,
      displayOrder: displayOrder ?? 0,
      isActive: isActive ?? true,
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: "Failed to create category", error });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, iconKey, iconImage, bannerImage, displayOrder, isActive } =
      req.body as {
        name?: string;
        description?: string;
        iconKey?: string;
        iconImage?: string;
        bannerImage?: string;
        displayOrder?: number;
        isActive?: boolean;
      };

    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    if (name !== undefined) category.name = name.trim();
    if (description !== undefined) category.description = description.trim();
    if (iconKey !== undefined) category.iconKey = iconKey;
    if (iconImage !== undefined) category.iconImage = iconImage;
    if (bannerImage !== undefined) category.bannerImage = bannerImage;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: "Failed to update category", error });
  }
};

export const setCategoryStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isActive } = req.body as { isActive?: boolean };
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive: isActive ?? true },
      { new: true }
    );
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: "Failed to update category status", error });
  }
};
