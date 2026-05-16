import mongoose from "mongoose";
import type { Queue } from "bullmq";
import type { SocketServer } from "../socket/socket";
import type { Env } from "../config/env";
import type { Logger } from "../lib/logger";
import { AppError } from "../errors/AppError";
import { parseUrlInput } from "../lib/parseUrlInput";
import { Batch } from "../models/Batch";
import { UrlCheck } from "../models/UrlCheck";
import type { BatchListCache } from "./batchListCache";
import type { UrlCheckJobData } from "../queue/urlCheckQueue";
import { emitBatchCancelled } from "../socket/socket";
import type { BatchProgressDto, UrlCheckResultDto } from "../shared/domain";
import { SERVER_BATCH_PROGRESS_EVENT } from "../shared";

export type BatchSummaryDto = {
  id: string;
  status: string;
  totalUrls: number;
  finishedCount: number;
  completedOk: number;
  failedCount: number;
  cancelledCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BatchDetailDto = {
  batch: BatchSummaryDto;
  urlChecks: UrlCheckResultDto[];
};

function toSummary(b: {
  _id: mongoose.Types.ObjectId;
  status: string;
  totalUrls: number;
  finishedCount: number;
  completedOk: number;
  failedCount: number;
  cancelledCount: number;
  createdAt: Date;
  updatedAt: Date;
}): BatchSummaryDto {
  return {
    id: b._id.toString(),
    status: b.status,
    totalUrls: b.totalUrls,
    finishedCount: b.finishedCount,
    completedOk: b.completedOk,
    failedCount: b.failedCount,
    cancelledCount: b.cancelledCount,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

function toUrlCheckDto(c: {
  _id: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  url: string;
  status: string;
  statusCode: number | null | undefined;
  responseTimeMs: number | null | undefined;
  title: string | null | undefined;
  error: string | null | undefined;
  finishedAt: Date | null | undefined;
}): UrlCheckResultDto {
  return {
    urlCheckId: c._id.toString(),
    batchId: c.batchId.toString(),
    url: c.url,
    status: c.status as UrlCheckResultDto["status"],
    statusCode: c.statusCode ?? null,
    responseTimeMs: c.responseTimeMs ?? null,
    title: c.title ?? null,
    error: c.error ?? null,
    finishedAt: c.finishedAt ? c.finishedAt.toISOString() : null,
  };
}

export async function buildProgressDto(
  batchId: string,
): Promise<BatchProgressDto | null> {
  const b = await Batch.findById(batchId).lean();
  if (!b) return null;
  return {
    batchId: b._id.toString(),
    totalUrls: b.totalUrls,
    finishedCount: b.finishedCount,
    completedOk: b.completedOk,
    failedCount: b.failedCount,
    cancelledCount: b.cancelledCount,
    batchStatus: b.status as BatchProgressDto["batchStatus"],
  };
}

export type BatchServiceDeps = {
  env: Env;
  logger: Logger;
  queue: Queue<UrlCheckJobData>;
  cache: BatchListCache;
  io: SocketServer;
};

export class BatchService {
  constructor(private readonly deps: BatchServiceDeps) {}

  async createBatchFromInput(raw: string): Promise<{ batchId: string; totalUrls: number }> {
    const urls = parseUrlInput(raw);
    if (urls.length === 0) {
      throw new AppError("No valid URLs found", {
        statusCode: 400,
        code: "EMPTY_INPUT",
        isOperational: true,
      });
    }
    if (urls.length > this.deps.env.MAX_URLS_PER_BATCH) {
      throw new AppError(`Maximum ${this.deps.env.MAX_URLS_PER_BATCH} URLs per batch`, {
        statusCode: 400,
        code: "BATCH_TOO_LARGE",
        isOperational: true,
      });
    }

    const batch = await Batch.create({
      status: "running",
      totalUrls: urls.length,
      finishedCount: 0,
      completedOk: 0,
      failedCount: 0,
      cancelledCount: 0,
    });

    const docs = urls.map((url, order) => ({
      batchId: batch._id,
      url,
      order,
      status: "queued" as const,
    }));

    const inserted = await UrlCheck.insertMany(docs);

    for (const c of inserted) {
      await this.deps.queue.add(
        "url-check",
        {
          batchId: batch._id.toString(),
          urlCheckId: c._id.toString(),
          url: c.url,
        },
        { jobId: c._id.toString() },
      );
    }

    await this.deps.cache.invalidate();
    this.deps.logger.info({ batchId: batch._id.toString(), n: urls.length }, "batch created");

    return { batchId: batch._id.toString(), totalUrls: urls.length };
  }

  async listBatches(): Promise<BatchSummaryDto[]> {
    const cached = await this.deps.cache.getCachedList();
    if (cached) {
      const parsed = JSON.parse(cached) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as BatchSummaryDto[];
      }
    }

    const rows = await Batch.find().sort({ createdAt: -1 }).limit(100).lean();
    const list = rows.map((b) =>
      toSummary({
        _id: b._id,
        status: b.status,
        totalUrls: b.totalUrls,
        finishedCount: b.finishedCount,
        completedOk: b.completedOk,
        failedCount: b.failedCount,
        cancelledCount: b.cancelledCount,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }),
    );

    await this.deps.cache.setCachedList(JSON.stringify(list));
    return list;
  }

  async getBatchDetail(batchId: string): Promise<BatchDetailDto> {
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      throw new AppError("Invalid batch id", {
        statusCode: 400,
        code: "INVALID_ID",
        isOperational: true,
      });
    }
    const b = await Batch.findById(batchId).lean();
    if (!b) {
      throw new AppError("Batch not found", {
        statusCode: 404,
        code: "NOT_FOUND",
        isOperational: true,
      });
    }
    const checks = await UrlCheck.find({ batchId: b._id })
      .sort({ order: 1 })
      .lean();

    return {
      batch: toSummary({
        _id: b._id,
        status: b.status,
        totalUrls: b.totalUrls,
        finishedCount: b.finishedCount,
        completedOk: b.completedOk,
        failedCount: b.failedCount,
        cancelledCount: b.cancelledCount,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }),
      urlChecks: checks.map((c) =>
        toUrlCheckDto({
          _id: c._id,
          batchId: c.batchId,
          url: c.url,
          status: c.status,
          statusCode: c.statusCode,
          responseTimeMs: c.responseTimeMs,
          title: c.title,
          error: c.error,
          finishedAt: c.finishedAt,
        }),
      ),
    };
  }

  async cancelBatch(batchId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      throw new AppError("Invalid batch id", {
        statusCode: 400,
        code: "INVALID_ID",
        isOperational: true,
      });
    }
    const b = await Batch.findById(batchId);
    if (!b) {
      throw new AppError("Batch not found", {
        statusCode: 404,
        code: "NOT_FOUND",
        isOperational: true,
      });
    }
    if (b.status === "cancelled" || b.status === "completed") {
      throw new AppError("Batch cannot be cancelled", {
        statusCode: 400,
        code: "INVALID_STATE",
        isOperational: true,
      });
    }

    const now = new Date();
    const queued = await UrlCheck.find({ batchId: b._id, status: "queued" });
    const n = queued.length;

    if (n > 0) {
      await UrlCheck.updateMany(
        { batchId: b._id, status: "queued" },
        { $set: { status: "cancelled", finishedAt: now } },
      );
      await Batch.updateOne(
        { _id: b._id },
        {
          $inc: { finishedCount: n, cancelledCount: n },
          $set: { status: "cancelled" },
        },
      );
    } else {
      await Batch.updateOne({ _id: b._id }, { $set: { status: "cancelled" } });
    }

    const jobs = await this.deps.queue.getJobs(["waiting", "delayed"]);
    for (const job of jobs) {
      const d = job.data as { batchId?: string };
      if (d.batchId === batchId) {
        await job.remove();
      }
    }

    await this.deps.cache.invalidate();
    emitBatchCancelled(this.deps.io, batchId);

    const progress = await buildProgressDto(batchId);
    if (progress) {
      this.deps.io
        .to(`batch:${batchId}`)
        .emit(SERVER_BATCH_PROGRESS_EVENT, progress);
    }
  }

  async retryFailed(batchId: string): Promise<{ retried: number }> {
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      throw new AppError("Invalid batch id", {
        statusCode: 400,
        code: "INVALID_ID",
        isOperational: true,
      });
    }
    const b = await Batch.findById(batchId);
    if (!b) {
      throw new AppError("Batch not found", {
        statusCode: 404,
        code: "NOT_FOUND",
        isOperational: true,
      });
    }

    const failed = await UrlCheck.find({ batchId: b._id, status: "failed" });
    if (failed.length === 0) {
      throw new AppError("No failed URLs to retry", {
        statusCode: 400,
        code: "NO_FAILED",
        isOperational: true,
      });
    }

    const n = failed.length;
    await UrlCheck.updateMany(
      { batchId: b._id, status: "failed" },
      {
        $set: {
          status: "queued",
          statusCode: null,
          responseTimeMs: null,
          title: null,
          error: null,
          finishedAt: null,
        },
      },
    );

    await Batch.updateOne(
      { _id: b._id },
      {
        $inc: { failedCount: -n, finishedCount: -n },
        $set: { status: "running" },
      },
    );

    for (const c of failed) {
      await this.deps.queue.add(
        "url-check",
        {
          batchId: b._id.toString(),
          urlCheckId: c._id.toString(),
          url: c.url,
        },
        { jobId: c._id.toString() },
      );
    }

    await this.deps.cache.invalidate();
    this.deps.logger.info({ batchId, retried: n }, "retry failed URLs");

    return { retried: n };
  }
}
