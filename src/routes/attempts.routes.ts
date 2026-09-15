import { Router } from "express";
import {
  startAttempt,
  saveAnswer,
  submitAttempt,
  getResult,
  getSolutions,
  getHistory,
} from "../controllers/attempt.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/start", requireAuth, startAttempt);
router.get("/history", requireAuth, getHistory);
router.patch("/:attemptId/answer", requireAuth, saveAnswer);
router.post("/:attemptId/submit", requireAuth, submitAttempt);
router.get("/:attemptId/result", requireAuth, getResult);
router.get("/:attemptId/solutions", requireAuth, getSolutions);

export default router;
