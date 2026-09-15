import { Router } from "express";
import { getPerformance } from "../controllers/performance.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, getPerformance);

export default router;
