import type Redis from "ioredis";
import {
  WORKER_SOCKET_REDIS_CHANNEL,
  type WorkerSocketMessage,
} from "../shared";

export async function publishWorkerSocketMessage(
  redis: Redis,
  message: WorkerSocketMessage,
): Promise<void> {
  await redis.publish(
    WORKER_SOCKET_REDIS_CHANNEL,
    JSON.stringify(message),
  );
}
