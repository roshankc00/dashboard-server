import { describe, expect, it } from "@jest/globals";
import {
  aggregateProgressFromChecks,
  progressFraction,
} from "./batchProgress";

describe("aggregateProgressFromChecks", () => {
  it("aggregates terminal states", () => {
    const p = aggregateProgressFromChecks([
      { status: "completed" },
      { status: "completed" },
      { status: "completed" },
      { status: "failed" },
      { status: "cancelled" },
      { status: "queued" },
    ]);
    expect(p).toEqual({
      total: 6,
      finished: 5,
      completedOk: 3,
      failed: 1,
      cancelled: 1,
    });
  });

  it("progressFraction handles empty", () => {
    expect(progressFraction(aggregateProgressFromChecks([]))).toBe(1);
  });
});
