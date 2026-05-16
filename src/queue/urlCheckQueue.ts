import { Queue } from "bullmq";
import type Redis from "ioredis";
import type { Env } from "../config/env";
import { URL_CHECK_QUEUE_NAME } from "../shared/constants";
import { urlCheckDefaultJobOptions } from "../lib/urlCheckQueueConfig";

export type UrlCheckJobData = {
  batchId: string;
  urlCheckId: string;
  url: string;
};

export function createUrlCheckQueue(
  env: Env,
  connection: Redis,
): Queue<UrlCheckJobData> {
  return new Queue<UrlCheckJobData>(URL_CHECK_QUEUE_NAME, {
    connection,
    prefix: env.BULLMQ_PREFIX,
    defaultJobOptions: urlCheckDefaultJobOptions,
  });
}
