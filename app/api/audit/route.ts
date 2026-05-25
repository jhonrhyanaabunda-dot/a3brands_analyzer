import { NextResponse } from "next/server";
import { scoreHtml, extractLocation, type AnalyzerResult } from "@/app/lib/analyzer";
import { scoreWithFirecrawl, getCachedAudit, setCachedAudit } from "@/app/lib/firecrawl";
import { fetchHtml } from "@/app/lib/fetchHtml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(rawUrl: string): string | null {
  let url = (rawUrl || "").trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try { new URL(url); return url; } catch { return null; }
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
      const location = (fc.city || fc.state)
        ? { city: fc.city, state: fc.state, businessName: fc.businessName, source: "firecrawl" as const }
        : null;
      const payload = {
        url,
        finalUrl: url,
        seo: fc.seo,
        aeo: fc.aeo,
        geo: fc.geo,
        total: fc.total,
        source: fc.source,
        reasoning: fc.reasoning,
        location,
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

  const fromJsonLd = extractLocation(result.html);
  const location = fromJsonLd
    ? { city: fromJsonLd.city, state: fromJsonLd.state, businessName: "", source: "jsonld" as const }
    : null;

  const payload = {
    url,
    finalUrl: result.finalUrl,
    seo: scores.seo,
    aeo: scores.aeo,
    geo: scores.geo,
    total: scores.total,
    source: scores.source,
    breakdown: scores.breakdown,
    location,
  };
  // Cache the analyzer result too — same TTL, same shape, so the next call is instant.
  setCachedAudit(url, payload).catch((err) => console.warn("audit cache write failed:", err));
  return NextResponse.json({ ok: true, ...payload });
}
