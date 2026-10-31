import { Router } from "express";
import { getSettings } from "../config";
import { pingDb } from "../db";
import { asyncHandler } from "../lib/http";

export const healthRouter = Router();

// A health check that is always healthy is a liar: 200 {status:"ok", db:"ok"}
// ONLY when MongoDB actually answers right now — 503 otherwise.
// Supports both /api/health and /health endpoints.
healthRouter.get(
  ["/api/health", "/health"],
  asyncHandler(async (_req, res) => {
    const dbOk = await pingDb();
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? "ok" : "error",
      version: getSettings().APP_VERSION,
      db: dbOk ? "ok" : "unavailable",
    });
  })
);
