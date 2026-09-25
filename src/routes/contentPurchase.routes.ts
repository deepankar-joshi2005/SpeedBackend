import { Router } from "express";
import {
  createContentOrder,
  verifyContentPayment,
  getMyContentPurchases,
} from "../controllers/contentPurchase.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/create-order", requireAuth, createContentOrder);
router.post("/verify-payment", requireAuth, verifyContentPayment);
router.get("/my-purchases", requireAuth, getMyContentPurchases);

export default router;
