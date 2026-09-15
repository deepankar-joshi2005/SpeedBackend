import { Router } from "express";
import {
  listCategories,
  getCategoryDetail,
  createCategory,
  updateCategory,
  setCategoryStatus,
} from "../../controllers/admin/category.controller";

const router = Router();

router.get("/", listCategories);
router.get("/:id", getCategoryDetail);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.patch("/:id/status", setCategoryStatus);

export default router;
