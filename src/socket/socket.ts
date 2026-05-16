import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import mongoose from "mongoose";
import { createBullRedis } from "../infra/redis";
import type { Env } from "../config/env";
import type { Logger } from "../lib/logger";
import {
  CLIENT_JOIN_BATCH_EVENT,
  SERVER_BATCH_CANCELLED_EVENT,
  SERVER_BATCH_PROGRESS_EVENT,
  SERVER_URL_RESULT_EVENT,
  WORKER_SOCKET_REDIS_CHANNEL,
  workerSocketMessageSchema,
} from "../shared";

export type SocketServer = Server;

export function createSocketServer(
  httpServer: HttpServer,
  env: Env,
  logger: Logger,
): { io: SocketServer; shutdownSockets: () => Promise<void> } {
  const cors =
    env.CORS_ORIGIN !== undefined
      ? {
          origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
          credentials: true as const,
        }
      : {
          origin: env.NODE_ENV !== "production",
          credentials: true as const,
        };

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors,
  });

  const pubClient = createBullRedis(env.REDIS_URL);
  const subClient = pubClient.duplicate();

  io.adapter(createAdapter(pubClient, subClient));

  const relaySub = createBullRedis(env.REDIS_URL);

  void relaySub.subscribe(WORKER_SOCKET_REDIS_CHANNEL).catch((err: unknown) => {
    logger.error({ err }, "Redis subscribe failed");
  });

  relaySub.on("message", (channel: string, message: string) => {
    if (channel !== WORKER_SOCKET_REDIS_CHANNEL) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message) as unknown;
    } catch {
      logger.warn("Invalid JSON on worker socket channel");
      return;
    }
    const r = workerSocketMessageSchema.safeParse(parsed);
    if (!r.success) {
      logger.warn({ issues: r.error.flatten() }, "Invalid worker socket payload");
      return;
    }
    const msg = r.data;
    const room = `batch:${msg.batchId}`;
    if (msg.type === "urlResult") {
      io.to(room).emit(SERVER_URL_RESULT_EVENT, msg.payload);
    } else {
      io.to(room).emit(SERVER_BATCH_PROGRESS_EVENT, msg.payload);
    }
  });

  io.on("connection", (socket) => {
    socket.on(CLIENT_JOIN_BATCH_EVENT, (batchId: unknown) => {
      if (typeof batchId !== "string") return;
      if (!mongoose.Types.ObjectId.isValid(batchId)) return;
      void socket.join(`batch:${batchId}`);
    });

    socket.on("batch:leave", (batchId: unknown) => {
      if (typeof batchId !== "string") return;
      void socket.leave(`batch:${batchId}`);
    });
  });

  const shutdownSockets = async (): Promise<void> => {
    relaySub.removeAllListeners("message");
    await relaySub.unsubscribe(WORKER_SOCKET_REDIS_CHANNEL);
    await relaySub.quit();
    await new Promise<void>((resolve, reject) => {
      io.close((err) => (err ? reject(err) : resolve()));
    });
    await pubClient.quit();
    await subClient.quit();
  };

  logger.info("Socket.io ready (Redis adapter + worker relay subscriber)");

  return { io, shutdownSockets };
}

export function emitBatchCancelled(
  io: SocketServer,
  batchId: string,
): void {
  io.to(`batch:${batchId}`).emit(SERVER_BATCH_CANCELLED_EVENT, { batchId });
}
