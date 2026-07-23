import { Router } from "express";
import { uploadMiddleware } from "../middleware/upload.middleware";
import { createScan, updateFinding, createSafeCopy, removeScan } from "../controllers/scans.controller";

export const scansRouter = Router();

scansRouter.post("/scans", uploadMiddleware.single("file"), createScan);
scansRouter.patch("/scans/:scanId/findings/:findingId", updateFinding);
scansRouter.post("/scans/:scanId/safe-copy", createSafeCopy);
scansRouter.delete("/scans/:scanId", removeScan);
