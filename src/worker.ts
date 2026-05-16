import { Worker } from "bullmq";
import { loadEnv } from "./config/env";
import { createLogger } from "./lib/logger";
import { connectMongo, disconnectMongo } from "./infra/mongo";
import { createBullRedis, createCacheRedis } from "./infra/redis";
import { URL_CHECK_QUEUE_NAME } from "./shared/constants";
import {
  buildWorkerOptions,
  URL_CHECK_JOB_ATTEMPTS,
} from "./lib/urlCheckQueueConfig";
import {
  finalizeFailedUrlCheck,
  processUrlCheckJob,
  type UrlCheckProcessorDeps,
} from "./jobs/urlCheckProcessor";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  await connectMongo(env.MONGODB_URI);

  const connection = createBullRedis(env.REDIS_URL);
  const publisher = createCacheRedis(env.REDIS_URL);
  const cacheRedis = createCacheRedis(env.REDIS_URL);

  const processorDeps: UrlCheckProcessorDeps = {
    env,
    logger,
    publisher,
    cacheRedis,
  };

  const worker = new Worker(
    URL_CHECK_QUEUE_NAME,
    async (job) => {
      await processUrlCheckJob(job, processorDeps);
    },
    {
      connection,
      prefix: env.BULLMQ_PREFIX,
      ...buildWorkerOptions(),
    },
  );

  worker.on("failed", (job, err) => {
    if (!job) return;
    const max = job.opts.attempts ?? URL_CHECK_JOB_ATTEMPTS;
    if (job.attemptsMade < max) {
      return;
    }
    void finalizeFailedUrlCheck(job, err, processorDeps).catch((e: unknown) => {
      logger.error({ err: e }, "finalizeFailedUrlCheck error");
    });
  });

  worker.on("error", (err) => {
    logger.error({ err }, "BullMQ worker error");
  });

  logger.info("URL check worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker shutdown");
    await worker.close();
    await connection.quit();
    await publisher.quit();
    await cacheRedis.quit();
    await disconnectMongo();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
