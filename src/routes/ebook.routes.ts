import { Router } from "express";
import {
  listEbooksForStudent,
  markEbookViewed,
  markEbookDownloaded,
  getMyDownloadedEbooks,
} from "../controllers/ebook.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listEbooksForStudent);
router.get("/my-downloads", requireAuth, getMyDownloadedEbooks);
router.patch("/:id/view", requireAuth, markEbookViewed);
router.patch("/:id/download", requireAuth, markEbookDownloaded);

export default router;
