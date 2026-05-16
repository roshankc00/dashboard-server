import { Router, type IRouter } from "express";
import { z } from "zod";
import { genReply } from "../lib/genReply";
import { appContainer } from "../wiring/container";

const createBatchBodySchema = z
  .object({
    input: z.string().optional(),
    urls: z.array(z.string()).optional(),
  })
  .refine((b) => (b.input !== undefined && b.input.length > 0) || (b.urls !== undefined && b.urls.length > 0), {
    message: "Provide `input` (paste/CSV text) or non-empty `urls`",
  });

export function createBatchesRouter(): IRouter {
  const router: IRouter = Router();

  router.post("/batches", async (req, res, next) => {
    try {
      const svc = appContainer.batchService;
      if (!svc) {
        res.status(503).json({
          success: false,
          error: { code: "NOT_READY", message: "Service initializing" },
        });
        return;
      }
      const body = createBatchBodySchema.parse(req.body);
      const raw =
        body.input ??
        (body.urls !== undefined ? body.urls.join("\n") : "");
      const out = await svc.createBatchFromInput(raw);
      genReply(res).created(out);
    } catch (e) {
      next(e);
    }
  });

  router.get("/batches", async (_req, res, next) => {
    try {
      const svc = appContainer.batchService;
      if (!svc) {
        res.status(503).json({
          success: false,
          error: { code: "NOT_READY", message: "Service initializing" },
        });
        return;
      }
      const list = await svc.listBatches();
      genReply(res).ok(list);
    } catch (e) {
      next(e);
    }
  });

  router.get("/batches/:batchId", async (req, res, next) => {
    try {
      const svc = appContainer.batchService;
      if (!svc) {
        res.status(503).json({
          success: false,
          error: { code: "NOT_READY", message: "Service initializing" },
        });
        return;
      }
      const detail = await svc.getBatchDetail(req.params.batchId);
      genReply(res).ok(detail);
    } catch (e) {
      next(e);
    }
  });

  router.post("/batches/:batchId/cancel", async (req, res, next) => {
    try {
      const svc = appContainer.batchService;
      if (!svc) {
        res.status(503).json({
          success: false,
          error: { code: "NOT_READY", message: "Service initializing" },
        });
        return;
      }
      await svc.cancelBatch(req.params.batchId);
      genReply(res).ok({ cancelled: true });
    } catch (e) {
      next(e);
    }
  });

  router.post("/batches/:batchId/retry-failed", async (req, res, next) => {
    try {
      const svc = appContainer.batchService;
      if (!svc) {
        res.status(503).json({
          success: false,
          error: { code: "NOT_READY", message: "Service initializing" },
        });
        return;
      }
      const out = await svc.retryFailed(req.params.batchId);
      genReply(res).ok(out);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
