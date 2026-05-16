import { describe, expect, it, jest } from "@jest/globals";
import { enqueueUrlCheckJob } from "./enqueueUrlCheckJob";
import type { UrlCheckJobData } from "./urlCheckQueue";

const data: UrlCheckJobData = {
  batchId: "batch1",
  urlCheckId: "check1",
  url: "https://example.com",
};

describe("enqueueUrlCheckJob", () => {
  it("adds a new job when none exists", async () => {
    const queue = {
      getJob: jest.fn(async () => undefined),
      add: jest.fn(async () => undefined),
    };
    await enqueueUrlCheckJob(queue as never, data, "check1");
    expect(queue.add).toHaveBeenCalledWith("url-check", data, { jobId: "check1" });
  });

  it("retries completed jobs instead of add", async () => {
    const retry = jest.fn(async () => undefined);
    const queue = {
      getJob: jest.fn(async () => ({
        getState: async () => "completed" as const,
        retry,
        remove: jest.fn(),
      })),
      add: jest.fn(),
    };
    await enqueueUrlCheckJob(queue as never, data, "check1");
    expect(retry).toHaveBeenCalledWith("completed");
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("retries failed jobs instead of add", async () => {
    const retry = jest.fn(async () => undefined);
    const queue = {
      getJob: jest.fn(async () => ({
        getState: async () => "failed" as const,
        retry,
        remove: jest.fn(),
      })),
      add: jest.fn(),
    };
    await enqueueUrlCheckJob(queue as never, data, "check1");
    expect(retry).toHaveBeenCalledWith("failed");
    expect(queue.add).not.toHaveBeenCalled();
  });
});
