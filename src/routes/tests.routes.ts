import { Router } from "express";
import {
  getTestSeriesSummary,
  getTestsByCategory,
  getTestInstructions,
  getFreeTests,
} from "../controllers/tests.controller";
import { getLeaderboard } from "../controllers/leaderboard.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/summary", requireAuth, getTestSeriesSummary);
router.get("/free", requireAuth, getFreeTests);
router.get("/category/:category", requireAuth, getTestsByCategory);
router.get("/:testId/instructions", requireAuth, getTestInstructions);
router.get("/:testId/leaderboard", requireAuth, getLeaderboard);

export default router;
