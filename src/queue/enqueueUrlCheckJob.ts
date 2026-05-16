import type { Queue } from "bullmq";
import type { UrlCheckJobData } from "./urlCheckQueue";

const URL_CHECK_JOB_NAME = "url-check";


export async function enqueueUrlCheckJob(
  queue: Queue<UrlCheckJobData>,
  data: UrlCheckJobData,
  jobId: string,
): Promise<void> {
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      await existing.retry(state);
      return;
    }
    if (
      state === "waiting" ||
      state === "delayed" ||
      state === "prioritized" ||
      state === "active"
    ) {
      return;
    }
    await existing.remove();
  }
  await queue.add(URL_CHECK_JOB_NAME, data, { jobId });
}
