import type { UrlCheckStatus } from "../shared/domain";

export type ProgressCounts = {
  total: number;
  finished: number;
  completedOk: number;
  failed: number;
  cancelled: number;
};

export function aggregateProgressFromChecks(
  checks: ReadonlyArray<{ status: UrlCheckStatus }>,
): ProgressCounts {
  let completedOk = 0;
  let failed = 0;
  let cancelled = 0;
  let finished = 0;

  for (const c of checks) {
    if (c.status === "completed") {
      completedOk += 1;
      finished += 1;
    } else if (c.status === "failed") {
      failed += 1;
      finished += 1;
    } else if (c.status === "cancelled") {
      cancelled += 1;
      finished += 1;
    }
  }

  return {
    total: checks.length,
    finished,
    completedOk,
    failed,
    cancelled,
  };
}

export function progressFraction(counts: ProgressCounts): number {
  if (counts.total === 0) return 1;
  return counts.finished / counts.total;
}
