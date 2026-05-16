import type { Application } from "express";
import { createHealthRouter } from "../routes/health.routes";
import { createBatchesRouter } from "../routes/batches.routes";

export function registerRoutes(app: Application): void {
  app.use("/api", createHealthRouter());
  app.use("/api", createBatchesRouter());
}
