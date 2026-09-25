import { Router } from "express";
import {
  getAdminSocialMedia,
  createAdminSocialMedia,
  updateAdminSocialMedia,
  deleteAdminSocialMedia,
} from "../../controllers/admin/adminSocialMedia.controller";

const router = Router();

router.get("/", getAdminSocialMedia);
router.post("/", createAdminSocialMedia);
router.put("/:id", updateAdminSocialMedia);
router.delete("/:id", deleteAdminSocialMedia);

export default router;
