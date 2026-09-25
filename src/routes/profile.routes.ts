import { Router } from "express";
import {
  getProfile,
  updateProfile,
  updateLanguage,
  updateProfileImage,
} from "../controllers/profile.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, getProfile);
router.patch("/", requireAuth, updateProfile);
router.patch("/photo", requireAuth, updateProfileImage);
router.patch("/language", requireAuth, updateLanguage);

export default router;
