import { extractTitleFromHtml } from "../lib/extractTitle";
import type { Env } from "../config/env";

export type FetchUrlResult = {
  statusCode: number;
  responseTimeMs: number;
  title: string | null;
};

export async function fetchUrlHeadline(
  url: string,
  env: Env,
): Promise<FetchUrlResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), env.URL_FETCH_TIMEOUT_MS);
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "UrlCheckDashboard/1.0",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    const responseTimeMs = Math.round(performance.now() - started);
    const ct = res.headers.get("content-type") ?? "";
    let title: string | null = null;
    if (ct.includes("text/html")) {
      const buf = await res.arrayBuffer();
      const slice = buf.byteLength > 256_000 ? buf.slice(0, 256_000) : buf;
      const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
      title = extractTitleFromHtml(html);
    }
    return { statusCode: res.status, responseTimeMs, title };
  } finally {
    clearTimeout(t);
  }
}
