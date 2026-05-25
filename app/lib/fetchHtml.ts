// Shared HTML fetcher used by both /api/audit (analyzer fallback) and
// /api/extract (location extractor). Honors a byte cap so a 50 MB page
// can't pin the server, follows redirects, and rejects non-HTML content.

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_500_000;

export type FetchResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; reason: string };

export async function fetchHtml(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SaggyAuditBot/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const ctype = res.headers.get("content-type") || "";
    if (ctype && !/html|text|xml/i.test(ctype)) return { ok: false, reason: "non_html" };

    const reader = res.body?.getReader();
    if (!reader) return { ok: false, reason: "no_body" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        chunks.push(value);
        if (total >= MAX_BYTES) break;
      }
    }
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return { ok: true, html, finalUrl: res.url || url };
  } catch (err: unknown) {
    const name = (err as { name?: string } | null)?.name;
    if (name === "AbortError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "fetch_error" };
  } finally {
    clearTimeout(timer);
  }
}
