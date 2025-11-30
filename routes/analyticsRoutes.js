import express from "express";
import { saveExamResult, getUserStats } from "../controllers/analyticsController.js";

const router = express.Router();

router.post("/result", saveExamResult);
router.get("/stats/:userId", getUserStats);

export default router;
