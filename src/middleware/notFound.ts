import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(
    new AppError("Not found", {
      statusCode: 404,
      code: "NOT_FOUND",
      isOperational: true,
    }),
  );
}
