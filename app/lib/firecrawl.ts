// Firecrawl-backed audit scorer.
//
// Uses POST https://api.firecrawl.dev/v2/scrape with the `json` format so
// Firecrawl's LLM reads the rendered page and rates SEO/AEO/GEO directly
// against a constrained schema. Cheaper than running our own browser farm,
// more accurate than regex heuristics, but non-deterministic and metered
// (this is a paid API). We cache by URL for 24h so repeated audits of the
// same dealership don't pay twice.
//
// Requires FIRECRAWL_API_KEY in the environment. If unset, this module
// throws and the caller falls back to the local analyzer.

import fs from "node:fs/promises";
import path from "node:path";

const SCRAPE_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";
const REQUEST_TIMEOUT_MS = 60_000;
const CACHE_FILE = path.join(process.cwd(), "data", "audit-cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SCORE_PROMPT = `You are auditing a dealership website. Rate it on three pillars, 0–20 each:

SEO — traditional ranking signals: title tag (length + keyword fit), meta description, canonical, headings hierarchy, image alts, internal linking, Core Web Vitals hints, mobile viewport, structured data presence.

AEO (Answer Engine Optimization) — how citation-ready the page is for ChatGPT / Perplexity / Gemini: FAQ schema, question-shaped headings, paragraph-level direct answers, author/entity markup, factual claims that an LLM can lift verbatim.

GEO (Generative Engine Optimization) — how Google's AI Overviews / SGE will treat this page: JSON-LD presence, LocalBusiness / AutoDealer / AutomotiveBusiness schema, postal address, telephone, geo coordinates, OpenGraph + Twitter cards, brand entity signals.

Be honest. Most dealerships score 8–15 per pillar. A perfect 20 should be very rare and only awarded when every signal is present and well-formed. A score of 0 means the site has none of that pillar's signals at all.

Return only integers 0–20 and a 1–2 sentence reasoning per pillar citing specific signals you observed (or their absence).

Also extract the dealership's primary city, US state (two-letter code), and business name from any LocalBusiness / AutoDealer / PostalAddress schema or the page's visible address. Leave empty if you cannot determine them with confidence.`;

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    seo: {
      type: "integer",
      minimum: 0,
      maximum: 20,
      description: "SEO score, 0-20.",
    },
    aeo: {
      type: "integer",
      minimum: 0,
      maximum: 20,
      description: "Answer Engine Optimization score, 0-20.",
    },
    geo: {
      type: "integer",
      minimum: 0,
      maximum: 20,
      description: "Generative Engine Optimization score, 0-20.",
    },
    seoReasoning: { type: "string", description: "1-2 sentences citing observed SEO signals." },
    aeoReasoning: { type: "string", description: "1-2 sentences citing observed AEO signals." },
    geoReasoning: { type: "string", description: "1-2 sentences citing observed GEO signals." },
    city: { type: "string", description: "City from LocalBusiness/PostalAddress, or empty." },
    state: { type: "string", description: "Two-letter US state code from PostalAddress, or empty." },
    businessName: { type: "string", description: "Dealership name from schema, or empty." },
  },
  required: ["seo", "aeo", "geo", "seoReasoning", "aeoReasoning", "geoReasoning"],
} as const;

export type FirecrawlScore = {
  seo: number;
  aeo: number;
  geo: number;
  total: number;
  source: "firecrawl";
  reasoning: { seo: string; aeo: string; geo: string };
  city: string;
  state: string;
  businessName: string;
};

function clamp20(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(20, Math.round(n)));
}

export async function scoreWithFirecrawl(url: string): Promise<FirecrawlScore> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(SCRAPE_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: [
          {
            type: "json",
            schema: SCORE_SCHEMA,
            prompt: SCORE_PROMPT,
          },
        ],
        onlyMainContent: false,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Firecrawl HTTP ${res.status}: ${detail.slice(0, 240)}`);
    }
    const body = await res.json().catch(() => null);
    if (!body || body.success === false) {
      throw new Error(`Firecrawl error: ${body?.error || "unknown"}`);
    }
    const extracted = body?.data?.json;
    if (!extracted || typeof extracted !== "object") {
      throw new Error("Firecrawl returned no json extract");
    }

    const seo = clamp20(Number(extracted.seo));
    const aeo = clamp20(Number(extracted.aeo));
    const geo = clamp20(Number(extracted.geo));
    return {
      seo, aeo, geo,
      total: seo + aeo + geo,
      source: "firecrawl",
      reasoning: {
        seo: String(extracted.seoReasoning || "").slice(0, 600),
        aeo: String(extracted.aeoReasoning || "").slice(0, 600),
        geo: String(extracted.geoReasoning || "").slice(0, 600),
      },
      city: String(extracted.city || "").slice(0, 120).trim(),
      state: String(extracted.state || "").slice(0, 8).trim(),
      businessName: String(extracted.businessName || "").slice(0, 200).trim(),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Disk cache ----------
// Single small JSON file. Keyed by URL string. Atomic writes via .tmp + rename.
// In-process locking is enough; multi-instance deploys should move this to
// the same place as leads.json (Phase 2 — Supabase).

type CacheEntry = { ts: number; data: any };

let cacheChain: Promise<void> = Promise.resolve();
function withCacheLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = cacheChain.then(fn, fn);
  cacheChain = run.then(() => undefined, () => undefined);
  return run;
}

async function readCacheFile(): Promise<Record<string, CacheEntry>> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCacheFile(c: Record<string, CacheEntry>): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  const tmp = CACHE_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(c, null, 2), "utf8");
  await fs.rename(tmp, CACHE_FILE);
}

export async function getCachedAudit(url: string): Promise<any | null> {
  const cache = await readCacheFile();
  const entry = cache[url];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data;
}

export async function setCachedAudit(url: string, data: any): Promise<void> {
  await withCacheLock(async () => {
    const cache = await readCacheFile();
    cache[url] = { ts: Date.now(), data };
    await writeCacheFile(cache);
  });
}
