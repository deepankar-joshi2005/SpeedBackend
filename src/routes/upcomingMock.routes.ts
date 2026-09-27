import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { getUpcomingMocks } from "../controllers/upcomingMock.controller";

const router = Router();

router.get("/", requireAuth, getUpcomingMocks);

export default router;
