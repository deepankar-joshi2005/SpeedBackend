import { Router } from "express";
import {
  listEbooksForStudent,
  markEbookViewed,
  markEbookDownloaded,
  getMyDownloadedEbooks,
  getEbookDemo,
} from "../controllers/ebook.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listEbooksForStudent);
router.get("/my-downloads", requireAuth, getMyDownloadedEbooks);
router.get("/:id/demo", requireAuth, getEbookDemo);
router.patch("/:id/view", requireAuth, markEbookViewed);
router.patch("/:id/download", requireAuth, markEbookDownloaded);

export default router;
