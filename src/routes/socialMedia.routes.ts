import { Router } from "express";
import { listSocialMediaForStudent } from "../controllers/socialMedia.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listSocialMediaForStudent);

export default router;
