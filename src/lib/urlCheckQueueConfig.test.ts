import { describe, expect, it } from "@jest/globals";
import {
  URL_CHECK_JOB_ATTEMPTS,
  buildWorkerOptions,
  urlCheckDefaultJobOptions,
  urlCheckLimiter,
} from "./urlCheckQueueConfig";

describe("urlCheckQueueConfig", () => {
  it("rate limiter is 10 jobs per second", () => {
    expect(urlCheckLimiter).toEqual({ max: 10, duration: 1000 });
  });

  it("worker concurrency is 5", () => {
    expect(buildWorkerOptions().concurrency).toBe(5);
  });

  it("job attempts include 3 retries after first failure", () => {
    expect(urlCheckDefaultJobOptions.attempts).toBe(URL_CHECK_JOB_ATTEMPTS);
    expect(URL_CHECK_JOB_ATTEMPTS).toBe(4);
    expect(urlCheckDefaultJobOptions.backoff).toEqual({
      type: "exponential",
      delay: 1000,
    });
  });
});
