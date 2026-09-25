import { Router } from "express";
import { getSectionalCategories, getSectionalSeriesTests } from "../controllers/sectional.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/categories", requireAuth, getSectionalCategories);
router.get("/:seriesId/tests", requireAuth, getSectionalSeriesTests);

export default router;
