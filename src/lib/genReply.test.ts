import { describe, expect, it, jest } from "@jest/globals";
import type { Response } from "express";
import { genReply } from "./genReply";

function mockRes(): Response {
  const json = jest.fn().mockReturnThis();
  const send = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json, send });
  return { status, json, send } as unknown as Response;
}

describe("genReply", () => {
  it("ok sends 200 and success body", () => {
    const res = mockRes();
    genReply(res).ok({ x: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { x: 1 } });
  });

  it("ok includes meta when provided", () => {
    const res = mockRes();
    genReply(res).ok({ x: 1 }, 200, { page: 1 });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { x: 1 },
      meta: { page: 1 },
    });
  });

  it("created uses 201", () => {
    const res = mockRes();
    genReply(res).created({ id: "a" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("noContent sends 204", () => {
    const res = mockRes();
    genReply(res).noContent();
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
