import { Router } from "express";
import {
  listSeries,
  getSeriesDetail,
  createSeries,
  updateSeries,
  publishSeries,
  duplicateSeries,
  deleteSeries,
  getSeriesTests,
} from "../../controllers/admin/series.controller";

const router = Router();

router.get("/", listSeries);
router.get("/:id", getSeriesDetail);
router.get("/:id/tests", getSeriesTests);
router.post("/", createSeries);
router.post("/:id/duplicate", duplicateSeries);
router.put("/:id", updateSeries);
router.patch("/:id/publish", publishSeries);
router.delete("/:id", deleteSeries);

export default router;
