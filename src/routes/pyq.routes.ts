import { Router } from "express";
import { listPyqsForStudent } from "../controllers/pyq.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listPyqsForStudent);

export default router;
