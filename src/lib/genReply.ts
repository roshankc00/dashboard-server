import type { Response } from "express";

export type ApiSuccessBody<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export function genReply(res: Response) {
  const ok = <T>(
    data: T,
    statusCode = 200,
    meta?: Record<string, unknown>,
  ): Response => {
    const body: ApiSuccessBody<T> =
      meta !== undefined
        ? { success: true, data, meta }
        : { success: true, data };
    return res.status(statusCode).json(body);
  };

  return {
    ok,
    created: <T>(data: T, meta?: Record<string, unknown>) =>
      ok(data, 201, meta),
    accepted: <T>(data: T) => ok(data, 202),
    noContent: (): Response => res.status(204).send(),
  };
}
