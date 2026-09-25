import { Router } from "express";
import {
  listEbooks,
  createEbook,
  updateEbook,
  setEbookStatus,
  deleteEbook,
} from "../../controllers/admin/ebook.controller";
import { uploadEbookFile } from "../../controllers/admin/upload.controller";
import { uploadEbookPdf } from "../../middleware/upload.middleware";

const router = Router();

router.get("/", listEbooks);
router.post("/", createEbook);
router.put("/:id", updateEbook);
router.patch("/:id/status", setEbookStatus);
router.delete("/:id", deleteEbook);
router.post("/upload", uploadEbookPdf.single("file"), uploadEbookFile);

export default router;
