import { NextResponse } from "next/server";
import { scoreHtml, type AnalyzerResult } from "@/app/lib/analyzer";
import { scoreWithFirecrawl, getCachedAudit, setCachedAudit } from "@/app/lib/firecrawl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_500_000; // 2.5 MB — long enough to cover most dealership homepages

function normalize(rawUrl: string): string | null {
  let url = (rawUrl || "").trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try { new URL(url); return url; } catch { return null; }
}

async function fetchHtml(url: string): Promise<{ ok: true; html: string; finalUrl: string } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Polite, recognizable, but not headless-flagged.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SaggyAuditBot/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const ctype = res.headers.get("content-type") || "";
    if (ctype && !/html|text|xml/i.test(ctype)) return { ok: false, reason: "non_html" };

    // Read with a byte cap so a 50MB page doesn't pin the server.
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
  } catch (err: any) {
    if (err?.name === "AbortError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "fetch_error" };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const url = normalize(body?.url);
  if (!url) return NextResponse.json({ ok: false, error: "invalid_url" }, { status: 400 });
  const skipCache = body?.refresh === true;

  // ---- 0. Cache check (avoids paying Firecrawl twice for the same URL within TTL)
  if (!skipCache) {
    const cached = await getCachedAudit(url).catch(() => null);
    if (cached) {
      return NextResponse.json({ ok: true, cached: true, ...cached });
    }
  }

  // ---- 1. Firecrawl LLM scoring (preferred when the key is configured)
  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const fc = await scoreWithFirecrawl(url);
      const payload = {
        url,
        finalUrl: url,
        seo: fc.seo,
        aeo: fc.aeo,
        geo: fc.geo,
        total: fc.total,
        source: fc.source,
        reasoning: fc.reasoning,
      };
      // Best-effort cache write; never fail the request on cache errors.
      setCachedAudit(url, payload).catch((err) => console.warn("audit cache write failed:", err));
      return NextResponse.json({ ok: true, ...payload });
    } catch (err) {
      console.warn("Firecrawl scoring failed for", url, "— falling back to local analyzer:", err);
    }
  }

  // ---- 2. Fallback: local fetch + heuristic analyzer
  const result = await fetchHtml(url);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason, url }, { status: 502 });
  }

  let scores: AnalyzerResult;
  try {
    scores = scoreHtml(result.html, result.finalUrl);
  } catch (err) {
    console.error("Analyzer threw for", url, err);
    return NextResponse.json({ ok: false, error: "analyzer_failed", url }, { status: 500 });
  }

  const payload = {
    url,
    finalUrl: result.finalUrl,
    seo: scores.seo,
    aeo: scores.aeo,
    geo: scores.geo,
    total: scores.total,
    source: scores.source,
    breakdown: scores.breakdown,
  };
  // Cache the analyzer result too — same TTL, same shape, so the next call is instant.
  setCachedAudit(url, payload).catch((err) => console.warn("audit cache write failed:", err));
  return NextResponse.json({ ok: true, ...payload });
}
