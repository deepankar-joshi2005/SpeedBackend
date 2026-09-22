import { Router } from "express";
import {
  getAdminSuccessStories,
  createAdminSuccessStory,
  updateAdminSuccessStory,
  deleteAdminSuccessStory,
} from "../../controllers/admin/adminSuccessStory.controller";

const router = Router();

router.get("/", getAdminSuccessStories);
router.post("/", createAdminSuccessStory);
router.put("/:id", updateAdminSuccessStory);
router.delete("/:id", deleteAdminSuccessStory);

export default router;
