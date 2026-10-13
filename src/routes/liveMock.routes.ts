import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { getLiveMocks } from "../controllers/liveMock.controller";

const router = Router();

router.get("/", requireAuth, getLiveMocks);

export default router;
