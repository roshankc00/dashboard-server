import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const REQUEST_ID_HEADER = "x-request-id";

export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.get(REQUEST_ID_HEADER);
  const requestId =
    typeof incoming === "string" && incoming.trim().length > 0
      ? incoming.trim()
      : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  req.requestId = requestId;
  next();
}
