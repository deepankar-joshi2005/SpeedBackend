import { Router } from "express";
import {
  listPyqsForStudent,
  markPyqDownloaded,
  getMyDownloadedPyqs,
} from "../controllers/pyq.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listPyqsForStudent);
router.get("/my-downloads", requireAuth, getMyDownloadedPyqs);
router.patch("/:id/download", requireAuth, markPyqDownloaded);

export default router;
