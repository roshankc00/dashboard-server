
export function parseUrlInput(input: string): string[] {
  const lines = input.split(/\r?\n/);
  const out: string[] = [];
  const seen = new Set<string>();

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    let cell = line;
    if (line.includes(",")) {
      cell = line.split(",")[0]?.trim() ?? "";
    }
    if (!cell) continue;
    const n = normalizeUrl(cell);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }

  return out;
}

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
