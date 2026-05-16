import path from "node:path";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import type { Env } from "./config/env";
import type { Logger } from "./lib/logger";
import { registerRoutes } from "./plugins";
import { requestContext } from "./middleware/requestContext";
import { notFoundHandler } from "./middleware/notFound";
import { createErrorHandler } from "./middleware/errorHandler";

export function createApp(env: Env, logger: Logger): Application {
  const app = express();

  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");

  app.use(requestContext);
  app.use(
    pinoHttp<Request, Response>({
      logger,
      genReqId: (req, _res) => req.requestId,
      customProps: (req, _res) => ({ requestId: req.requestId }),
      autoLogging: {
        ignore: (req) =>
          req.url === "/api/health" || req.url === "/api/ready",
      },
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  const corsOrigin =
    env.CORS_ORIGIN !== undefined
      ? env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
      : env.NODE_ENV !== "production";

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: "RATE_LIMIT", message: "Too many requests" },
      },
    }),
  );

  registerRoutes(app);

  app.get("/", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "index.html"));
  });

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger, env));

  return app;
}