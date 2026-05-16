const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;

export function extractTitleFromHtml(html: string): string | null {
  const m = TITLE_RE.exec(html.slice(0, 256_000));
  if (!m?.[1]) return null;
  const raw = m[1].replace(/\s+/g, " ").trim();
  return raw.length > 0 ? raw : null;
}
