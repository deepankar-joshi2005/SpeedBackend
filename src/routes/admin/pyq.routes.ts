import { Router } from "express";
import {
  listPyqs,
  createPyq,
  updatePyq,
  setPyqStatus,
  deletePyq,
} from "../../controllers/admin/pyq.controller";
import { uploadPyqFile } from "../../controllers/admin/upload.controller";
import { uploadPyqPdf } from "../../middleware/upload.middleware";

const router = Router();

router.get("/", listPyqs);
router.post("/", createPyq);
router.put("/:id", updatePyq);
router.patch("/:id/status", setPyqStatus);
router.delete("/:id", deletePyq);
router.post("/upload", uploadPyqPdf.single("file"), uploadPyqFile);

export default router;
