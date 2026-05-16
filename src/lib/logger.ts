import pino from "pino";
import type { Env } from "../config/env";

export function createLogger(env: Env) {
  return pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    base: {
      env: env.NODE_ENV,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
