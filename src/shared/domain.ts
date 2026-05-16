import { z } from "zod";

export const BATCH_STATUSES = [
  "queued",
  "running",
  "completed",
  "cancelled",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const URL_CHECK_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type UrlCheckStatus = (typeof URL_CHECK_STATUSES)[number];

export const urlCheckResultDtoSchema = z.object({
  urlCheckId: z.string(),
  batchId: z.string(),
  url: z.string(),
  status: z.enum(URL_CHECK_STATUSES),
  statusCode: z.number().nullable(),
  responseTimeMs: z.number().nullable(),
  title: z.string().nullable(),
  error: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type UrlCheckResultDto = z.infer<typeof urlCheckResultDtoSchema>;

export const batchProgressDtoSchema = z.object({
  batchId: z.string(),
  totalUrls: z.number(),
  finishedCount: z.number(),
  completedOk: z.number(),
  failedCount: z.number(),
  cancelledCount: z.number(),
  batchStatus: z.enum(BATCH_STATUSES),
});
export type BatchProgressDto = z.infer<typeof batchProgressDtoSchema>;

/** Wire format worker → Redis → API */
export const workerSocketMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("urlResult"),
    batchId: z.string(),
    payload: urlCheckResultDtoSchema,
  }),
  z.object({
    type: z.literal("batchProgress"),
    batchId: z.string(),
    payload: batchProgressDtoSchema,
  }),
]);
export type WorkerSocketMessage = z.infer<typeof workerSocketMessageSchema>;

/** Client → server */
export const CLIENT_JOIN_BATCH_EVENT = "batch:join";
/** Server → client */
export const SERVER_URL_RESULT_EVENT = "batch:urlResult";
export const SERVER_BATCH_PROGRESS_EVENT = "batch:progress";
export const SERVER_BATCH_CANCELLED_EVENT = "batch:cancelled";
