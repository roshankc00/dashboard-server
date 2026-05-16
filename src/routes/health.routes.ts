import { Router, type IRouter } from "express";
import mongoose from "mongoose";
import { genReply } from "../lib/genReply";
import { appContainer } from "../wiring/container";

export function createHealthRouter(): IRouter {
  const router: IRouter = Router();

  router.get("/health", (_req, res) => {
    genReply(res).ok({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/ready", async (_req, res, next) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        res.status(503).json({
          success: false,
          error: { code: "NOT_READY", message: "MongoDB not connected" },
        });
        return;
      }
      const redis = appContainer.redisHealth;
      if (!redis) {
        res.status(503).json({
          success: false,
          error: { code: "NOT_READY", message: "Redis not wired" },
        });
        return;
      }
      const pong = await redis.ping();
      if (pong !== "PONG") {
        res.status(503).json({
          success: false,
          error: { code: "NOT_READY", message: "Redis ping failed" },
        });
        return;
      }
      genReply(res).ok({ ready: true, mongo: true, redis: true });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
