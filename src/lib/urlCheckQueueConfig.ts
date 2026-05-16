import type { JobsOptions, WorkerOptions } from "bullmq";

export const URL_CHECK_JOB_ATTEMPTS = 4;

export const urlCheckLimiter: NonNullable<WorkerOptions["limiter"]> = {
  max: 10,
  duration: 1000,
};

export const urlCheckWorkerConcurrency = 5;

export const urlCheckDefaultJobOptions: JobsOptions = {
  attempts: URL_CHECK_JOB_ATTEMPTS,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 500 },
};

export function buildWorkerOptions(): Pick<
  WorkerOptions,
  "concurrency" | "limiter"
> {
  return {
    concurrency: urlCheckWorkerConcurrency,
    limiter: urlCheckLimiter,
  };
}
