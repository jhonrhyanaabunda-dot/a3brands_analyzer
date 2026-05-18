// Server-side site analyzer.
//
// Given the raw HTML of a dealer's site, score it on three pillars:
//   SEO  — traditional ranking signals (title, meta, canonical, etc.)
//   AEO  — answer-engine optimization (FAQ schema, question-style content)
//   GEO  — generative-engine optimization (JSON-LD, LocalBusiness, NAP)
//
// Each pillar is 0–20. Total is 0–60. Numbers are derived from observable
// markup, not random — same site = same score every time, but different
// sites produce different reports. This is the heart of "make results dynamic."
//
// Heuristics, not Lighthouse. Good enough to differentiate sites and feel
// honest. Easy to evolve.

export type PillarBreakdown = {
  score: number;            // 0–20, integer
  max: number;              // always 20
  signals: { label: string; ok: boolean; weight: number; detail?: string }[];
};

export type AnalyzerResult = {
  seo: number;
  aeo: number;
  geo: number;
  total: number;            // 0–60
  source: "analyzer";
  breakdown: { seo: PillarBreakdown; aeo: PillarBreakdown; geo: PillarBreakdown };
};

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function clamp20(n: number) {
  return Math.max(0, Math.min(20, Math.round(n)));
}

function extractAll(re: RegExp, html: string): RegExpMatchArray[] {
  return [...html.matchAll(re)];
}

function findAttr(tag: string, attr: string, html: string): string | null {
  // Find a tag and return the requested attribute value. Case-insensitive,
  // tolerates single or double quotes.
  const tagRe = new RegExp(`<${tag}\\b[^>]*>`, "i");
  const m = html.match(tagRe);
  if (!m) return null;
  const attrRe = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i");
  const am = m[0].match(attrRe);
  return am ? am[1] : null;
}

function findMeta(name: string, html: string): string | null {
  // <meta name="..." content="..."> OR <meta property="..." content="...">
  const re = new RegExp(
    `<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`,
    "i",
  );
  const m = html.match(re);
  if (!m) return null;
  const cm = m[0].match(/content\s*=\s*["']([^"']*)["']/i);
  return cm ? cm[1] : null;
}

function getJsonLdBlocks(html: string): any[] {
  const blocks: any[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = (m[1] || "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // Some sites have multiple objects glued together or bad JSON; skip.
    }
  }
  return blocks;
}

function flattenLdTypes(node: any, acc: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== "object") return acc;
  if (Array.isArray(node)) {
    for (const item of node) flattenLdTypes(item, acc);
    return acc;
  }
  const t = node["@type"];
  if (typeof t === "string") acc.add(t);
  else if (Array.isArray(t)) for (const x of t) if (typeof x === "string") acc.add(x);
  // Walk into common nested locations
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (v && typeof v === "object") flattenLdTypes(v, acc);
  }
  return acc;
}

function hasLdShape(blocks: any[], predicate: (node: any) => boolean): boolean {
  const stack: any[] = [...blocks];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) { for (const x of node) stack.push(x); continue; }
    if (predicate(node)) return true;
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return false;
}

function nodeIsType(node: any, name: string): boolean {
  const t = node?.["@type"];
  if (typeof t === "string") return t.toLowerCase() === name.toLowerCase();
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && x.toLowerCase() === name.toLowerCase());
  return false;
}

// =============================================================
//   SEO PILLAR  (0–20)
// =============================================================
function scoreSEO(html: string, baseUrl: string): PillarBreakdown {
  const signals: PillarBreakdown["signals"] = [];

  // Title
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "";
  const titlePresent = title.length > 0;
  const titleLenOk = title.length >= 30 && title.length <= 65;
  signals.push({ label: "Title tag", ok: titlePresent, weight: 2, detail: titlePresent ? `${title.length} chars` : "missing" });
  signals.push({ label: "Title length 30–65", ok: titleLenOk, weight: 2 });

  // Meta description
  const desc = findMeta("description", html) || "";
  const descPresent = desc.length > 0;
  const descLenOk = desc.length >= 110 && desc.length <= 170;
  signals.push({ label: "Meta description", ok: descPresent, weight: 2, detail: descPresent ? `${desc.length} chars` : "missing" });
  signals.push({ label: "Description length 110–170", ok: descLenOk, weight: 2 });

  // Canonical
  const canonical = !!html.match(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i);
  signals.push({ label: "Canonical link", ok: canonical, weight: 2 });

  // HTML lang
  const lang = findAttr("html", "lang", html);
  signals.push({ label: "html[lang] set", ok: !!(lang && lang.length >= 2), weight: 2 });

  // Viewport
  const viewport = findMeta("viewport", html);
  signals.push({ label: "Viewport meta", ok: !!viewport, weight: 2 });

  // Single H1
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  signals.push({ label: "Exactly one H1", ok: h1Count === 1, weight: 2, detail: `${h1Count} found` });

  // Image alt coverage
  const imgs = extractAll(/<img\b[^>]*>/gi, html).map((m) => m[0]);
  const imgWithAlt = imgs.filter((tag) => /\salt\s*=\s*["'][^"']+["']/i.test(tag)).length;
  const altRatio = imgs.length ? imgWithAlt / imgs.length : 0;
  const altOk = imgs.length === 0 || altRatio >= 0.7;
  signals.push({
    label: "Image alt coverage ≥70%",
    ok: altOk,
    weight: 2,
    detail: imgs.length ? `${imgWithAlt}/${imgs.length}` : "no images",
  });

  // Internal links (count anchors whose href starts with / or includes the host)
  let host = "";
  try { host = new URL(baseUrl).hostname.replace(/^www\./, ""); } catch {}
  const anchors = extractAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi, html);
  let internal = 0;
  for (const a of anchors) {
    const href = a[1];
    if (!href || href.startsWith("#")) continue;
    if (href.startsWith("/") && !href.startsWith("//")) { internal++; continue; }
    if (host && href.includes(host)) internal++;
  }
  signals.push({ label: "Internal links ≥10", ok: internal >= 10, weight: 2, detail: `${internal} found` });

  const earned = signals.reduce((sum, s) => sum + (s.ok ? s.weight : 0), 0);
  return { score: clamp20(earned), max: 20, signals };
}

// =============================================================
//   AEO PILLAR  (0–20)
// =============================================================
function scoreAEO(html: string): PillarBreakdown {
  const signals: PillarBreakdown["signals"] = [];
  const ld = getJsonLdBlocks(html);
  const types = flattenLdTypes(ld);

  const hasFAQ = types.has("FAQPage") || types.has("FAQ");
  signals.push({ label: "FAQPage schema", ok: hasFAQ, weight: 5 });

  const hasQA = types.has("QAPage") || types.has("Question");
  signals.push({ label: "QAPage / Question schema", ok: hasQA, weight: 3 });

  const hasHowTo = types.has("HowTo");
  signals.push({ label: "HowTo schema", ok: hasHowTo, weight: 2 });

  // Question-style headings
  const headings = extractAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, html)
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  const questionHeadings = headings.filter((t) => /\?$/.test(t.trim())).length;
  signals.push({
    label: "Question-style headings ≥3",
    ok: questionHeadings >= 3,
    weight: 3,
    detail: `${questionHeadings} found`,
  });

  // Article + author signal
  const hasArticleAuthor = hasLdShape(ld, (n) => (nodeIsType(n, "Article") || nodeIsType(n, "NewsArticle") || nodeIsType(n, "BlogPosting")) && !!n.author);
  signals.push({ label: "Article schema with author", ok: hasArticleAuthor, weight: 2 });

  // Plain readable text volume (lots of dealerships have giant inventory tables and no real prose)
  const text = stripTags(html);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  signals.push({ label: "Text content ≥500 words", ok: wordCount >= 500, weight: 3, detail: `${wordCount} words` });

  // Paragraph structure
  const paragraphs = (html.match(/<p\b/gi) || []).length;
  signals.push({ label: "Multiple paragraphs (≥8)", ok: paragraphs >= 8, weight: 2, detail: `${paragraphs} found` });

  const earned = signals.reduce((sum, s) => sum + (s.ok ? s.weight : 0), 0);
  return { score: clamp20(earned), max: 20, signals };
}

// =============================================================
//   GEO PILLAR  (0–20)
// =============================================================
function scoreGEO(html: string): PillarBreakdown {
  const signals: PillarBreakdown["signals"] = [];
  const ld = getJsonLdBlocks(html);
  const types = flattenLdTypes(ld);

  signals.push({ label: "JSON-LD present", ok: ld.length > 0, weight: 3, detail: `${ld.length} block(s)` });

  const businessTypes = ["LocalBusiness", "AutoDealer", "AutomotiveBusiness", "AutoRepair", "Store", "Organization"];
  const hasBusiness = businessTypes.some((t) => types.has(t));
  signals.push({ label: "Business / LocalBusiness schema", ok: hasBusiness, weight: 6 });

  const hasAddress = hasLdShape(ld, (n) => nodeIsType(n, "PostalAddress") || !!n.address);
  signals.push({ label: "Postal address in schema", ok: hasAddress, weight: 3 });

  const hasGeo = hasLdShape(ld, (n) => nodeIsType(n, "GeoCoordinates") || !!n.geo);
  signals.push({ label: "Geo coordinates in schema", ok: hasGeo, weight: 2 });

  const hasPhone = hasLdShape(ld, (n) => !!n.telephone) || /href\s*=\s*["']tel:/i.test(html);
  signals.push({ label: "Phone exposed (tel: or schema)", ok: hasPhone, weight: 2 });

  const ogTitle = findMeta("og:title", html);
  const ogDesc = findMeta("og:description", html);
  const ogImg = findMeta("og:image", html);
  const ogComplete = !!(ogTitle && ogDesc && ogImg);
  signals.push({ label: "OpenGraph (title + desc + image)", ok: ogComplete, weight: 2 });

  const twitter = findMeta("twitter:card", html);
  signals.push({ label: "Twitter card", ok: !!twitter, weight: 2 });

  const earned = signals.reduce((sum, s) => sum + (s.ok ? s.weight : 0), 0);
  return { score: clamp20(earned), max: 20, signals };
}

// =============================================================
//   PUBLIC: score an HTML page
// =============================================================
export function scoreHtml(html: string, baseUrl: string): AnalyzerResult {
  const seoBreakdown = scoreSEO(html, baseUrl);
  const aeoBreakdown = scoreAEO(html);
  const geoBreakdown = scoreGEO(html);
  const seo = seoBreakdown.score;
  const aeo = aeoBreakdown.score;
  const geo = geoBreakdown.score;
  return {
    seo, aeo, geo,
    total: seo + aeo + geo,
    source: "analyzer",
    breakdown: { seo: seoBreakdown, aeo: aeoBreakdown, geo: geoBreakdown },
  };
}
