import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";
import type { Logger } from "../lib/logger";
import type { Env } from "../config/env";

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
    stack?: string;
  };
};

export function createErrorHandler(
  logger: Logger,
  env: Env,
): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const requestId = req.requestId;

    if (res.headersSent) {
      logger.error(
        { err, requestId },
        "Error after response was sent; skipping JSON error body",
      );
      return;
    }

    const { statusCode, body, logPayload } = normalizeError(err, env);
    body.error.requestId = requestId;

    if (statusCode >= 500) {
      logger.error({ err, requestId, ...logPayload }, err.message);
    } else {
      logger.warn({ err, requestId, ...logPayload }, err.message);
    }

    res.status(statusCode).json(body);
  };
}

function normalizeError(
  err: unknown,
  env: Env,
): {
  statusCode: number;
  body: ErrorBody;
  logPayload: Record<string, unknown>;
} {
  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: err.flatten(),
        },
      },
      logPayload: { issues: err.issues },
    };
  }

  if (err instanceof AppError) {
    const body: ErrorBody = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
    // Never send stack traces for operational errors (404, validation-style AppErrors, etc.).
    if (
      env.NODE_ENV === "development" &&
      !err.isOperational &&
      err.statusCode >= 500
    ) {
      body.error.stack = err.stack;
    }
    return {
      statusCode: err.statusCode,
      body,
      logPayload: { code: err.code, isOperational: err.isOperational },
    };
  }

  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";
  const body: ErrorBody = {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : message,
    },
  };
  if (env.NODE_ENV === "development" && err instanceof Error) {
    body.error.stack = err.stack;
  }

  return {
    statusCode: 500,
    body,
    logPayload: { unexpected: true },
  };
}
