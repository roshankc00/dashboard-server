import type { Job } from "bullmq";
import type Redis from "ioredis";
import type { Env } from "../config/env";
import type { Logger } from "../lib/logger";
import { Batch } from "../models/Batch";
import { UrlCheck } from "../models/UrlCheck";
import type { UrlCheckJobData } from "../queue/urlCheckQueue";
import { fetchUrlHeadline } from "../services/urlFetchService";
import { buildProgressDto } from "../services/batchService";
import { publishWorkerSocketMessage } from "../socket/publishWorkerEvent";
import { BATCH_LIST_CACHE_KEY } from "../shared/constants";
import type { UrlCheckResultDto } from "../shared/domain";

export type UrlCheckProcessorDeps = {
  env: Env;
  logger: Logger;
  publisher: Redis;
  cacheRedis: Redis;
};

async function invalidateBatchListCache(
  redis: Redis,
  logger: Logger,
): Promise<void> {
  const n = await redis.del(BATCH_LIST_CACHE_KEY);
  logger.debug({ deletedKeys: n }, "batch list cache invalidated (worker)");
}

async function maybeCompleteBatch(batchId: string): Promise<void> {
  const b = await Batch.findById(batchId).lean();
  if (!b) return;
  if (b.status === "cancelled") return;
  if (b.finishedCount >= b.totalUrls) {
    await Batch.updateOne({ _id: b._id }, { $set: { status: "completed" } });
  }
}

export async function processUrlCheckJob(
  job: Job<UrlCheckJobData>,
  deps: UrlCheckProcessorDeps,
): Promise<void> {
  const { batchId, urlCheckId, url } = job.data;

  const batch = await Batch.findById(batchId);
  const check = await UrlCheck.findById(urlCheckId);
  if (!batch || !check) {
    deps.logger.warn({ jobId: job.id }, "missing batch or urlCheck");
    return;
  }

  if (
    check.status === "completed" ||
    check.status === "failed" ||
    check.status === "cancelled"
  ) {
    return;
  }

  if (batch.status === "cancelled" && check.status === "queued") {
    return;
  }

  const transitioned = await UrlCheck.findOneAndUpdate(
    { _id: check._id, status: { $in: ["queued", "running"] } },
    { $set: { status: "running" } },
    { new: true },
  );

  if (!transitioned || transitioned.status !== "running") {
    return;
  }

  if (batch.status === "cancelled") {
    return;
  }

  let result: Awaited<ReturnType<typeof fetchUrlHeadline>>;
  try {
    result = await fetchUrlHeadline(url, deps.env);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    throw err;
  }
  const now = new Date();

  const up = await UrlCheck.updateOne(
    { _id: check._id, status: "running" },
    {
      $set: {
        status: "completed",
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        title: result.title,
        error: null,
        finishedAt: now,
      },
    },
  );

  if (up.modifiedCount !== 1) {
    return;
  }

  await Batch.updateOne(
    { _id: batch._id },
    { $inc: { finishedCount: 1, completedOk: 1 } },
  );
  await maybeCompleteBatch(batchId);
  await invalidateBatchListCache(deps.cacheRedis, deps.logger);

  const dto: UrlCheckResultDto = {
    urlCheckId,
    batchId,
    url,
    status: "completed",
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    title: result.title,
    error: null,
    finishedAt: now.toISOString(),
  };

  await publishWorkerSocketMessage(deps.publisher, {
    type: "urlResult",
    batchId,
    payload: dto,
  });

  const progress = await buildProgressDto(batchId);
  if (progress) {
    await publishWorkerSocketMessage(deps.publisher, {
      type: "batchProgress",
      batchId,
      payload: progress,
    });
  }
}

export async function finalizeFailedUrlCheck(
  job: Job<UrlCheckJobData> | undefined,
  err: unknown,
  deps: UrlCheckProcessorDeps,
): Promise<void> {
  if (!job?.data) return;
  const error = err instanceof Error ? err : new Error(String(err));
  const { batchId, urlCheckId, url } = job.data;

  const now = new Date();
  const up = await UrlCheck.updateOne(
    { _id: urlCheckId, status: "running" },
    {
      $set: {
        status: "failed",
        error: error.message,
        finishedAt: now,
      },
    },
  );

  if (up.modifiedCount !== 1) {
    return;
  }

  await Batch.updateOne(
    { _id: batchId },
    { $inc: { finishedCount: 1, failedCount: 1 } },
  );
  await maybeCompleteBatch(batchId);
  await invalidateBatchListCache(deps.cacheRedis, deps.logger);

  const dto: UrlCheckResultDto = {
    urlCheckId,
    batchId,
    url,
    status: "failed",
    statusCode: null,
    responseTimeMs: null,
    title: null,
    error: error.message,
    finishedAt: now.toISOString(),
  };

  await publishWorkerSocketMessage(deps.publisher, {
    type: "urlResult",
    batchId,
    payload: dto,
  });

  const progress = await buildProgressDto(batchId);
  if (progress) {
    await publishWorkerSocketMessage(deps.publisher, {
      type: "batchProgress",
      batchId,
      payload: progress,
    });
  }
}
