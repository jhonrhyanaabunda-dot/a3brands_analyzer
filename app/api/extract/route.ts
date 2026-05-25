// Lightweight location-extraction endpoint used by the audit funnel after
// the user submits a URL but before the full /api/audit runs. Cascades
// through JSON-LD → OG/meta → visible text → hostname inference, returning
// the first hit with a confidence label. Skips Firecrawl entirely — the
// goal is sub-3s feedback so the user can confirm "We found you in X, Y."

import { NextResponse } from "next/server";
import { extractLocation } from "@/app/lib/analyzer";
import { fetchHtml } from "@/app/lib/fetchHtml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

// Compact list of US cities that show up in dealer hostnames. Not exhaustive —
// just enough to disambiguate hits like "fordofhouston" from "fordofnorthamerica".
const CITY_SLUGS = new Set([
  "houston","dallas","austin","sanantonio","fortworth","elpaso","arlington","plano",
  "phoenix","tucson","mesa","scottsdale","chandler","glendale","gilbert","tempe","prescott",
  "losangeles","sandiego","sanjose","sanfrancisco","sacramento","longbeach","oakland","bakersfield","fresno","anaheim",
  "denver","coloradosprings","aurora","boulder",
  "miami","tampa","orlando","jacksonville","fortlauderdale","stpetersburg","tallahassee",
  "atlanta","savannah","augusta","columbus","macon",
  "chicago","naperville","aurora","peoria",
  "newyork","brooklyn","queens","bronx","manhattan","buffalo","rochester","albany","syracuse",
  "philadelphia","pittsburgh","allentown","erie",
  "boston","cambridge","worcester","springfield",
  "seattle","spokane","tacoma","bellevue","everett",
  "portland","eugene","salem","beaverton",
  "lasvegas","reno","henderson",
  "nashville","memphis","knoxville","chattanooga","clarksville",
  "charlotte","raleigh","durham","greensboro","winstonsalem","asheville",
  "indianapolis","fortwayne","evansville","southbend",
  "columbus","cleveland","cincinnati","toledo","akron","dayton",
  "detroit","grandrapids","annarbor","lansing","flint",
  "minneapolis","stpaul","rochester","duluth",
  "stlouis","kansascity","springfield","columbia",
  "neworleans","batonrouge","shreveport","lafayette",
  "richmond","virginiabeach","norfolk","chesapeake","alexandria","arlington","fairfax",
  "baltimore","annapolis","frederick","rockville",
  "salt​lakecity","saltlakecity","ogden","provo",
  "milwaukee","madison","greenbay","kenosha",
  "louisville","lexington","bowlinggreen",
  "oklahomacity","tulsa","norman",
  "birmingham","montgomery","mobile","huntsville",
  "littlerock","fayetteville",
]);

function normalize(rawUrl: string): string | null {
  let url = (rawUrl || "").trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try { new URL(url); return url; } catch { return null; }
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}

function normalizeState(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (US_STATES.has(t)) return t;
  // Allow full state names like "Arizona" — keep only the first 8 chars uppercase,
  // but only when we cannot map to a 2-letter code. The UI just renders the string.
  return raw.trim().slice(0, 32);
}

// Layer 3 — OG / meta scan.
function fromOgMeta(html: string): { city: string; state: string } | null {
  const metaRe = (name: string) =>
    new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`, "i");
  const contentOf = (tag: string | null) => {
    if (!tag) return "";
    const m = tag.match(/content\s*=\s*["']([^"']*)["']/i);
    return m ? m[1].trim() : "";
  };
  const cityRaw =
    contentOf(html.match(metaRe("og:locality"))?.[0] ?? null) ||
    contentOf(html.match(metaRe("place:location:locality"))?.[0] ?? null) ||
    contentOf(html.match(metaRe("geo.placename"))?.[0] ?? null);
  const stateRaw =
    contentOf(html.match(metaRe("og:region"))?.[0] ?? null) ||
    contentOf(html.match(metaRe("place:location:region"))?.[0] ?? null) ||
    contentOf(html.match(metaRe("geo.region"))?.[0] ?? null);
  if (!cityRaw && !stateRaw) return null;
  // geo.region is often "US-AZ" — strip the "US-" prefix.
  const state = stateRaw.replace(/^US[-_]/i, "");
  return { city: cityRaw, state };
}

// Layer 4 — visible-text regex. Looks for "<City>, ST" patterns outside
// <script> and <style> blocks.
function fromVisibleText(html: string): { city: string; state: string } | null {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const stateAlt = [...US_STATES].join("|");
  // Match "City, ST" where City is 2–40 letters/spaces and ST is a real US code.
  const re = new RegExp(`\\b([A-Z][A-Za-z .'\\-]{1,38}[A-Za-z]),\\s+(${stateAlt})\\b`);
  const m = stripped.match(re);
  if (!m) return null;
  return { city: m[1].trim(), state: m[2] };
}

// Layer 5 — hostname inference. Looks for "of<city>" / "in<city>" segments
// in the host, matched against CITY_SLUGS to avoid false positives.
function fromHostname(host: string): { city: string; state: string } | null {
  const h = host.toLowerCase().replace(/^www\./, "").replace(/\..*$/, "");
  const m = h.match(/(?:of|in|near)([a-z]{4,30})/);
  if (!m) return null;
  const slug = m[1];
  if (!CITY_SLUGS.has(slug)) return null;
  // Best-effort de-slug: insert spaces before capitalized words.
  const pretty = slug.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (c) => c.toUpperCase());
  return { city: pretty, state: "" };
}

export async function POST(req: Request) {
  let body: { url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const url = normalize(body?.url ?? "");
  if (!url) return NextResponse.json({ ok: false, error: "invalid_url" }, { status: 400 });

  const fetched = await fetchHtml(url);
  if (!fetched.ok) {
    return NextResponse.json(
      { ok: true, city: "", state: "", confidence: null, source: null, fetchFailed: fetched.reason },
    );
  }

  // Layer 2 — JSON-LD via the analyzer's shared walker.
  const fromLd = extractLocation(fetched.html);
  if (fromLd && (fromLd.city || fromLd.state)) {
    return NextResponse.json({
      ok: true,
      city: titleCase(fromLd.city),
      state: normalizeState(fromLd.state),
      confidence: "high",
      source: "jsonld",
    });
  }

  // Layer 3 — OG / meta tags.
  const fromOg = fromOgMeta(fetched.html);
  if (fromOg && (fromOg.city || fromOg.state)) {
    return NextResponse.json({
      ok: true,
      city: titleCase(fromOg.city),
      state: normalizeState(fromOg.state),
      confidence: "mid",
      source: "og",
    });
  }

  // Layer 4 — visible text regex.
  const fromText = fromVisibleText(fetched.html);
  if (fromText) {
    return NextResponse.json({
      ok: true,
      city: titleCase(fromText.city),
      state: normalizeState(fromText.state),
      confidence: "mid",
      source: "text",
    });
  }

  // Layer 5 — hostname inference.
  let host = "";
  try { host = new URL(fetched.finalUrl).hostname; } catch { /* ignore */ }
  const fromHost = host ? fromHostname(host) : null;
  if (fromHost) {
    return NextResponse.json({
      ok: true,
      city: titleCase(fromHost.city),
      state: normalizeState(fromHost.state),
      confidence: "low",
      source: "hostname",
    });
  }

  return NextResponse.json({
    ok: true,
    city: "",
    state: "",
    confidence: null,
    source: null,
  });
}
