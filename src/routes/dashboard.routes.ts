import { Router } from "express";
import { getDashboard, getStreak } from "../controllers/dashboard.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, getDashboard);
router.get("/streak", requireAuth, getStreak);

export default router;
