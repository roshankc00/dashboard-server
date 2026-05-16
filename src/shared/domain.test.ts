import { describe, expect, it } from "@jest/globals";
import { workerSocketMessageSchema } from "../shared/domain";

describe("workerSocketMessageSchema", () => {
  it("accepts urlResult messages", () => {
    const r = workerSocketMessageSchema.safeParse({
      type: "urlResult",
      batchId: "test-batch-id",
      payload: {
        urlCheckId: "test-url-check-id",
        batchId: "test-batch-id",
        url: "https://blog.roshankarki1.com.np",
        status: "completed",
        statusCode: 200,
        responseTimeMs: 12,
        title: "Hello boom Roshan Karki backend engineer yoo yoo",
        error: null,
        finishedAt: new Date().toISOString(),
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid payloads", () => {
    const r = workerSocketMessageSchema.safeParse({
      type: "urlResult",
      batchId: "x",
      payload: {},
    });
    expect(r.success).toBe(false);
  });
});
