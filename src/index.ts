import { createServer } from "node:http";
import { loadEnv } from "./config/env";
import { createLogger } from "./lib/logger";
import { createApp } from "./app";
import { connectMongo, disconnectMongo } from "./infra/mongo";
import { createBullRedis, createCacheRedis } from "./infra/redis";
import { createUrlCheckQueue } from "./queue/urlCheckQueue";
import { BatchListCache } from "./services/batchListCache";
import { BatchService } from "./services/batchService";
import { createSocketServer } from "./socket/socket";
import { appContainer } from "./wiring/container";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);

  await connectMongo(env.MONGODB_URI);

  const queueConnection = createBullRedis(env.REDIS_URL);
  const queue = createUrlCheckQueue(env, queueConnection);

  const cacheRedis = createCacheRedis(env.REDIS_URL);
  const redisHealth = createCacheRedis(env.REDIS_URL);
  const batchListCache = new BatchListCache(cacheRedis, env, logger);

  const app = createApp(env, logger);
  const server = createServer(app);

  const { io, shutdownSockets } = createSocketServer(server, env, logger);

  const batchService = new BatchService({
    env,
    logger,
    queue,
    cache: batchListCache,
    io,
  });

  appContainer.batchService = batchService;
  appContainer.redisHealth = redisHealth;

  const port = env.PORT;

  server.listen(port, () => {
    logger.info({ port }, "HTTP server listening");
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "Shutdown initiated");
    appContainer.batchService = undefined;
    appContainer.redisHealth = undefined;

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    await shutdownSockets();
    await queue.close();
    await queueConnection.quit();
    await cacheRedis.quit();
    await redisHealth.quit();
    await disconnectMongo();

    logger.info("Shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled promise rejection");
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    process.exit(1);
  });
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
