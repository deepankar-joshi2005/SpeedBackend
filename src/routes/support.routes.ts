import { Router } from "express";
import { createTicket, getTickets } from "../controllers/support.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/tickets", requireAuth, getTickets);
router.post("/tickets", requireAuth, createTicket);

export default router;
