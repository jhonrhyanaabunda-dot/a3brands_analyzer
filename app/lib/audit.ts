// @ts-nocheck
// Lifted verbatim from the legacy index.html <script>. Logic, comments, and
// behavior are intentionally identical to the static site — only the boot
// shape changes (everything is wrapped in initAudit() so React can call it
// from useEffect after the DOM exists). Future PRs are where we'll
// componentize this; the minimal port keeps churn close to zero.

let _booted = false;

export function initAudit() {
  if (typeof window === "undefined") return;
  if (_booted) return;
  _booted = true;

  // ============================================================
  //   THE OUTRANK AUDIT — Saggy goes hunting
  // ============================================================

  // ---- CONFIG ----
  const PSI_API_KEY = ""; // Optional. https://developers.google.com/speed/docs/insights/v5/get-started
  const GHL_WEBHOOK_URL = "PASTE_YOUR_GHL_WEBHOOK_URL_HERE";
  const BOOK_CALL_URL = "https://a3brands.com/book-a-call/";
  const CPL_BENCHMARK = 80; // $/lead — A3 automotive benchmark

  // Estimated organic CTR by SERP position (industry-standard Sistrix/Backlinko data)
  const CTR_BY_RANK: Record<number, number> = {
    1: 0.3, 2: 0.15, 3: 0.1, 4: 0.06, 5: 0.04,
    6: 0.03, 7: 0.025, 8: 0.02, 9: 0.018, 10: 0.015,
  };
  const LEAD_CONVERSION_RATE = 0.03;
  const DEFAULT_TRADE_AREA_VOLUME = 1800;

  const BANDS = [
    { min: 90, name: "Trade Area Champ", verdict: (_gap, _host) => `You're already running the trade area. Nobody in your zip is touching this. Now let's lock the lead before someone closes the gap.` },
    { min: 75, name: "Solid Ground",     verdict: (_gap, host) => `You're in good shape but <b>${host}</b> is finding ways to chip at you. Closeable. Don't let it slide.` },
    { min: 60, name: "Slipping",         verdict: (_gap, _host) => `You're showing up in regular search. You're getting <b>lapped</b> in AI search. The gap is paying somebody else's mortgage right now.` },
    { min: 40, name: "Bleeding",         verdict: (_gap, host) => `<b>${host}</b> and two others are eating your trade area. The good news is every gap below is fixable — and we know exactly where to start.` },
    { min: 0,  name: "Off The Map",      verdict: (_gap, _host) => `Tough number. But here's the thing, your competitors aren't crushing it, you're just <b>not in the game yet</b>. Let's get you on the board.` },
  ];

  const state: any = {
    url: "", city: "", cityConfidence: null, make: "",
    // Captured on the interactive intro (Stage 2). Default to "" so a skipped
    // intro just yields a less-personalized report — never a broken one.
    goal: "", rival: "",
    competitorUrls: [], yourScores: null, competitorScores: [],
    monthlyDamage: 0, monthlyLostLeads: 0, monthlyLostClicks: 0,
    yourEstimatedRank: 4,
    audioEnabled: false,
    scanComplete: false,
  };

  const $ = (id: string) => document.getElementById(id);
  function show(screenId: string) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(screenId)?.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    updateStepIndicator(screenId);
  }
  function updateStepIndicator(screenId: string) {
    const map: Record<string, string> = {
      "screen-landing": "",
      "screen-sales-dash": '<span>Sales</span><span class="dot">·</span><span>Console</span>',
      "screen-scan": '<span>Step</span><span class="dot">·</span><span>Audit In Progress</span>',
      "screen-leadcap": '<span>Step</span><span class="dot">·</span><span>Report Ready</span>',
      "screen-result": '<span>Step</span><span class="dot">·</span><span>Your Outrank Report</span>',
    };
    const el = $("stepIndicator"); if (el) el.innerHTML = map[screenId] || "";
  }
  function hostnameOf(url: string) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }
  function normalizeUrl(raw: string) {
    let url = (raw || "").trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); return url; } catch { return false; }
  }
  function escapeHTML(s: any) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Sandbox-safe fetch with timeout. We deliberately do NOT use AbortController/AbortSignal here —
  // some embed contexts (iframe sandboxes, certain mobile WebViews, some preview platforms) proxy
  // fetch through window.postMessage, and AbortSignal is not structured-cloneable, so passing it
  // throws "DataCloneError: AbortSignal object could not be cloned." The trade-off: the underlying
  // request continues in the background after timeout, but the caller sees a clean rejection.
  function timeoutFetch(url: string, options?: RequestInit, ms?: number) {
    const opts = options || {};
    const limit = ms || 15000;
    return Promise.race([
      fetch(url, opts),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout after " + limit + "ms")), limit)),
    ]);
  }

  // Deterministic-feeling random seeded on a URL
  function urlSeed(url: string) {
    let h = 0;
    for (let i = 0; i < url.length; i++) {
      h = ((h << 5) - h) + url.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }
  function seededRand(seed: number, mod: number) {
    const x = Math.sin(seed) * 10000;
    return Math.floor((x - Math.floor(x)) * mod);
  }

  // ============================================================
  //   DEALERSHIP VALIDATION
  // ============================================================
  const NON_DEALER_HOSTS = new Set([
    "facebook.com","fb.com","instagram.com","twitter.com","x.com","tiktok.com",
    "linkedin.com","youtube.com","snapchat.com","pinterest.com","reddit.com","threads.net",
    "gmail.com","yahoo.com","outlook.com","hotmail.com","aol.com","icloud.com","protonmail.com",
    "google.com","bing.com","duckduckgo.com","github.com","gitlab.com","stackoverflow.com","wikipedia.org",
    "amazon.com","ebay.com","etsy.com","walmart.com","target.com","shopify.com","apple.com","microsoft.com",
    "craigslist.org","autotrader.com","cars.com","carvana.com","carmax.com","cargurus.com","truecar.com","kbb.com","edmunds.com",
  ]);
  const DEALER_KEYWORDS = [
    "dealership","dealer","inventory","pre-owned","used car","used cars","test drive",
    "service department","showroom","carfax","certified pre-owned","schedule service",
    "auto group","auto sales","motors","new vehicles","finance application","trade-in",
  ];
  const BRAND_KEYWORDS = [
    "toyota","honda","ford","chevrolet","chevy","ram","dodge","jeep","chrysler","gmc",
    "buick","cadillac","lincoln","mazda","hyundai","kia","subaru","volkswagen","audi",
    "bmw","mercedes","lexus","infiniti","acura","nissan","mitsubishi","volvo","porsche",
    "jaguar","land rover","range rover","tesla","rivian","lucid","genesis","mini",
  ];
  function checkObviousNonDealer(url: string) {
    let host: string;
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
    catch { return null; }
    if (host === "localhost" || /^127\./.test(host) || /^192\.168\./.test(host) || /^10\./.test(host)) {
      return "That's a local network address, not a dealership site.";
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return "That's an IP address. Use your actual dealership domain.";
    if (/\.(local|test|localhost)$/.test(host)) return "That's a local test domain, not a real site.";
    for (const denied of NON_DEALER_HOSTS) {
      if (host === denied || host.endsWith("." + denied)) {
        return `${denied} isn't a car dealership. Drop in your actual dealership URL.`;
      }
    }
    return null;
  }

  // Best-effort make detection from the hostname (e.g. "bmwofsouthatlanta.com" → "bmw").
  // Falls back to "" so the caller can default to "automotive". Cheaper and more
  // reliable than a third-party HTML reader pre-flight.
  function detectMakeFromUrl(url: string): string {
    let host = "";
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
    for (const brand of BRAND_KEYWORDS) {
      const normalized = brand.replace(/ /g, "");
      if (host.includes(normalized)) return brand;
    }
    return "";
  }

  async function readSite(url: string) {
    try {
      const res: any = await timeoutFetch("https://r.jina.ai/" + url, {
        headers: { "X-Return-Format": "text" },
      }, 18000);
      if (!res.ok) return { ok: res.status < 500, reason: res.status >= 500 ? "reader_down" : "unreachable", text: "" };
      const text = (await res.text()).toLowerCase();
      if (!text || text.length < 200) return { ok: false, reason: "empty", text: "" };
      let hits = 0;
      for (const kw of DEALER_KEYWORDS) { if (text.includes(kw)) { hits++; if (hits >= 3) break; } }
      const brandCounts: Record<string, number> = {};
      for (const b of BRAND_KEYWORDS) {
        const matches = text.match(new RegExp("\\b" + b.replace(/ /g, "\\s") + "\\b", "g"));
        if (matches) brandCounts[b] = matches.length;
      }
      const topBrand = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0];
      const make = topBrand ? topBrand[0] : "";
      return { ok: hits >= 3, reason: hits >= 3 ? "dealer" : "no_signals", hits, make, text };
    } catch (err) {
      console.warn("Site read failed:", err);
      return { ok: true, reason: "check_failed", text: "", make: "" };
    }
  }

  async function discoverCompetitors(make: string, city: string, ownUrl: string) {
    const ownHost = hostnameOf(ownUrl);
    const queries = [
      `${make} dealer near ${city}`,
      `${make} dealership ${city}`,
      `best ${make} dealer ${city}`,
    ];
    const found = new Map<string, number>();
    for (const q of queries) {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
      let text = "";
      try {
        const res: any = await timeoutFetch("https://r.jina.ai/" + url, {
          headers: { "X-Return-Format": "text" },
        }, 15000);
        if (res.ok) text = await res.text();
      } catch (err) {
        console.warn("Competitor search failed for query:", q, err);
      }
      if (!text) continue;

      const hostMatches = [...text.matchAll(/https?:\/\/(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/gi)];
      let rank = 0;
      for (const m of hostMatches) {
        const host = m[1].toLowerCase().replace(/^www\./, "");
        if (host === ownHost) continue;
        if (NON_DEALER_HOSTS.has(host)) continue;
        if (/duckduckgo|google|bing|youtube|facebook|instagram|yelp|yellowpages|wikipedia|amazonaws|cloudflare|jina|gstatic|w3\.org/.test(host)) continue;
        let aggregator = false;
        for (const agg of NON_DEALER_HOSTS) {
          if (host.endsWith("." + agg)) { aggregator = true; break; }
        }
        if (aggregator) continue;
        const looksLikeDealer = BRAND_KEYWORDS.some((b) => host.includes(b.replace(/ /g, ""))) ||
          /dealer|auto|motor|cars?\b|cdjr|ford|gmc|chevy|hyundai|kia/.test(host);
        if (!looksLikeDealer) continue;
        if (!found.has(host)) found.set(host, rank);
        rank++;
        if (found.size >= 8) break;
      }
      if (found.size >= 5) break;
    }
    return [...found.keys()].slice(0, 3).map((h) => "https://" + h);
  }

  const GEO_AUDITS = [
    "meta-description","document-title","is-crawlable","robots-txt",
    "image-alt","link-text","crawlable-anchors","canonical",
    "structured-data","heading-order",
  ];
  async function fetchAlgoScoresPSI(url: string) {
    const params = new URLSearchParams({ url, strategy: "mobile" });
    ["PERFORMANCE","SEO","ACCESSIBILITY","BEST_PRACTICES"].forEach((c) => params.append("category", c));
    if (PSI_API_KEY) params.set("key", PSI_API_KEY);
    const endpoint = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + params.toString();

    const res: any = await timeoutFetch(endpoint, {}, 50000);
    if (!res.ok) throw new Error("PSI HTTP " + res.status);
    const data = await res.json();
    const lh = data?.lighthouseResult || {};
    const cats = lh.categories || {};
    const audits = lh.audits || {};
    const seo = cats.seo?.score ?? null;
    const a11y = cats.accessibility?.score ?? null;
    const bp = cats["best-practices"]?.score ?? null;
    if (seo === null || a11y === null || bp === null) throw new Error("PSI missing categories");

    let geoSum = 0, geoCount = 0;
    for (const id of GEO_AUDITS) {
      const audit = audits[id];
      if (!audit) continue;
      let v;
      if (audit.score === null || audit.score === undefined) {
        v = audit.scoreDisplayMode === "manual" ? 0.5 : null;
      } else {
        v = audit.score;
      }
      if (v === null) continue;
      geoSum += v; geoCount++;
    }
    const geoRatio = geoCount > 0 ? geoSum / geoCount : 0;
    const seoPts = Math.round(seo * 20);
    const aeoPts = Math.round(((a11y + bp) / 2) * 20);
    const geoPts = Math.round(geoRatio * 20);
    return { seo: seoPts, aeo: aeoPts, geo: geoPts, total: seoPts + aeoPts + geoPts, source: "psi" };
  }
  function computeAlgoScoresSeeded(url: string) {
    const seed = urlSeed(url);
    const seo = 8 + seededRand(seed + 1, 11);
    const aeo = 4 + seededRand(seed + 2, 9);
    const geo = 2 + seededRand(seed + 3, 9);
    return { seo, aeo, geo, total: seo + aeo + geo, source: "seeded" };
  }
  // Call our own server-side analyzer (fetches HTML and scores real signals).
  // This is what makes the report dynamic per-site; if it fails (timeouts,
  // blocking, etc.) we fall through to PSI and finally seeded.
  async function fetchAlgoScoresAnalyzer(url: string) {
    const res: any = await timeoutFetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }, 15000);
    if (!res.ok) throw new Error("audit api HTTP " + res.status);
    const data = await res.json();
    if (!data?.ok) throw new Error("audit api error " + (data?.error || "unknown"));
    return {
      seo: data.seo, aeo: data.aeo, geo: data.geo, total: data.total,
      source: data.source || "analyzer",
      breakdown: data.breakdown,
    };
  }
  async function computeAlgoScores(url: string) {
    try { return await fetchAlgoScoresAnalyzer(url); }
    catch (analyzerErr) {
      console.warn("Analyzer failed for", url, "— trying PSI:", analyzerErr);
      try { return await fetchAlgoScoresPSI(url); }
      catch (psiErr) {
        console.warn("PSI failed for", url, "— using seeded:", psiErr);
        return computeAlgoScoresSeeded(url);
      }
    }
  }

  // Trade-area volume varies by city + make. Bigger markets and popular brands
  // see more search volume. Deterministic per (city, make) so the same inputs
  // always produce the same number — but two different markets produce
  // genuinely different damage math.
  const POPULAR_MAKES = new Set([
    "toyota","honda","ford","chevrolet","chevy","ram","jeep","gmc",
    "hyundai","kia","nissan","subaru",
  ]);
  const NICHE_MAKES = new Set([
    "porsche","jaguar","land rover","range rover","tesla","rivian","lucid","genesis","mini","mazda","volvo",
  ]);
  function tradeAreaVolumeFor(city: string, make: string): number {
    const cityKey = (city || "").toLowerCase().trim();
    const makeKey = (make || "").toLowerCase().trim();
    // Base derived from city-string hash (stable per city), 900–2700
    const base = 900 + (urlSeed(cityKey || "anywhere") % 1800);
    // Make multiplier
    let mult = 1.0;
    if (POPULAR_MAKES.has(makeKey)) mult = 1.35;
    else if (NICHE_MAKES.has(makeKey)) mult = 0.55;
    // Big-city bump if the city name suggests a metro
    if (/\b(houston|phoenix|miami|dallas|atlanta|chicago|los angeles|new york|nyc|brooklyn|queens|austin|denver|seattle|boston|philadelphia|tampa|orlando|las vegas|sacramento|san diego|san francisco|portland|nashville|charlotte|columbus|indianapolis)\b/i.test(cityKey)) {
      mult *= 1.4;
    }
    return Math.round(base * mult);
  }

  function calculateDamage(yourScores: any, competitorScores: any[]) {
    const all = [
      { id: "you", total: yourScores.total },
      ...competitorScores.map((c, i) => ({ id: "c" + i, total: c.scores.total })),
    ].sort((a, b) => b.total - a.total);
    const yourRank = all.findIndex((x) => x.id === "you") + 1;

    const ceilingRank = yourRank === 1 ? 1 : 1;
    const yourCTR = CTR_BY_RANK[Math.min(yourRank + 2, 10)] ?? 0.015;
    const ceilingCTR = CTR_BY_RANK[Math.min(ceilingRank + 2, 10)] ?? 0.3;
    const lostShare = Math.max(0, ceilingCTR - yourCTR);
    const tradeAreaVolume = tradeAreaVolumeFor(state.city, state.make);
    const lostClicks = Math.round(lostShare * tradeAreaVolume);
    const lostLeads = Math.round(lostClicks * LEAD_CONVERSION_RATE);
    const damage = lostLeads * CPL_BENCHMARK;

    return {
      yourRank, ceilingRank,
      yourCTR, ceilingCTR,
      tradeAreaVolume,
      lostShare, lostClicks, lostLeads, damage,
    };
  }

  // ============================================================
  //   SAGGY VOICE-OVER
  // ============================================================
  const SAGGY_SUPPORTS_TTS = typeof window !== "undefined" && "speechSynthesis" in window;
  let _saggyVoice: any = null;
  function pickSaggyVoice() {
    if (!SAGGY_SUPPORTS_TTS) return null;
    if (_saggyVoice) return _saggyVoice;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const preferred = ["Junior","Eddy","Reed","Flo","Rocko","Shelley","Aaron","Arthur","Rishi","Microsoft Guy","Google UK English Male"];
    for (const name of preferred) {
      const v = voices.find((x) => x.name.toLowerCase().includes(name.toLowerCase()) && /en[-_]/i.test(x.lang));
      if (v) { _saggyVoice = v; return v; }
    }
    _saggyVoice = voices.find((v) => /^en/i.test(v.lang)) || voices[0];
    return _saggyVoice;
  }
  if (SAGGY_SUPPORTS_TTS) {
    window.speechSynthesis.onvoiceschanged = () => { _saggyVoice = null; pickSaggyVoice(); };
  }
  let _saggyKeepAlive: any = null;
  function _saggyStartKeepAlive() {
    if (_saggyKeepAlive) return;
    _saggyKeepAlive = setInterval(() => {
      const ss = window.speechSynthesis;
      if (!ss.speaking) { clearInterval(_saggyKeepAlive); _saggyKeepAlive = null; return; }
      ss.pause(); ss.resume();
    }, 10000);
  }
  function saggySpeak(text: string) {
    if (!SAGGY_SUPPORTS_TTS || !state.audioEnabled || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickSaggyVoice();
      if (v) u.voice = v;
      u.rate = 1.05; u.pitch = 1.25; u.volume = 1.0;
      u.onend = () => { if (_saggyKeepAlive) { clearInterval(_saggyKeepAlive); _saggyKeepAlive = null; } };
      u.onerror = u.onend;
      window.speechSynthesis.speak(u);
      _saggyStartKeepAlive();
    } catch (err) { console.warn("TTS failed:", err); }
  }
  function saggyStop() {
    if (!SAGGY_SUPPORTS_TTS) return;
    window.speechSynthesis.cancel();
    if (_saggyKeepAlive) { clearInterval(_saggyKeepAlive); _saggyKeepAlive = null; }
  }
  function initAudioToggle() {
    const btn = $("audioToggle"); if (!btn) return;
    try { if (localStorage.getItem("saggyAudio") === "1") { state.audioEnabled = true; btn.setAttribute("aria-pressed","true"); } } catch {}
    if (!SAGGY_SUPPORTS_TTS) { (btn as HTMLButtonElement).disabled = true; btn.title = "Voice-over not supported here"; return; }
    btn.addEventListener("click", () => {
      state.audioEnabled = !state.audioEnabled;
      btn.setAttribute("aria-pressed", state.audioEnabled ? "true" : "false");
      try { localStorage.setItem("saggyAudio", state.audioEnabled ? "1" : "0"); } catch {}
      if (state.audioEnabled) {
        const bubble = $("speechBubble");
        if (bubble && bubble.textContent) saggySpeak(bubble.textContent);
      } else { saggyStop(); }
    });
  }
  function reactSaggy() {
    const s = document.getElementById("saggyImg");
    if (!s) return;
    s.classList.remove("react");
    void (s as HTMLElement).offsetWidth;
    s.classList.add("react");
  }
  function setSpeech(text: string) {
    const bubble = $("speechBubble");
    if (!bubble) return;
    const newBubble = bubble.cloneNode(false) as HTMLElement;
    newBubble.id = "speechBubble";
    newBubble.className = "speech-bubble";
    newBubble.textContent = text;
    bubble.parentNode!.replaceChild(newBubble, bubble);
    reactSaggy();
    saggySpeak(text);
  }

  // ============================================================
  //   LANDING — kick off audit
  // ============================================================
  $("startBtn")?.addEventListener("click", kickoffAudit);
  $("urlInput")?.addEventListener("keydown", (e: any) => { if (e.key === "Enter") kickoffAudit(); });

  async function kickoffAudit() {
    const url = normalizeUrl(($("urlInput") as HTMLInputElement)?.value || "");
    if (url === null) { $("urlError")!.textContent = "Drop in your dealership URL to get started."; return; }
    if (url === false) { $("urlError")!.textContent = "That URL doesn't look valid. Try again."; return; }
    const obviousReject = checkObviousNonDealer(url as string);
    if (obviousReject) { $("urlError")!.textContent = obviousReject; return; }

    state.url = url;
    state.city = "";
    state.cityConfidence = null;
    state.goal = "";
    state.rival = "";
    $("urlError")!.textContent = "";

    // Detect make from the hostname (e.g. "bmwofsouthatlanta.com" → "bmw").
    // The audit pipeline downstream (Firecrawl → analyzer → seeded) handles
    // unreachable sites on its own; no third-party pre-flight needed.
    state.make = detectMakeFromUrl(url as string) || "automotive";

    // Fire the location extractor in parallel with the scanning theater.
    // runScanSequence awaits state.extractPromise before step 1 so the
    // "Trade area locked in — X, Y" beat reads the real city when available.
    state.extractPromise = fetchLocation(url as string);

    show("screen-scan");
    runScanSequence();
  }

  async function fetchLocation(url: string): Promise<void> {
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        keepalive: true,
      });
      if (!res.ok) return;
      const payload: any = await res.json().catch(() => null);
      const city = (payload?.city || "").trim();
      const stateStr = (payload?.state || "").trim();
      const combined = city && stateStr ? `${city}, ${stateStr}` : (city || stateStr || "");
      if (combined) {
        state.city = combined;
        state.cityConfidence = payload?.confidence ?? null;
      }
    } catch (e) {
      console.warn("/api/extract failed:", e);
    }
  }

  async function runScanSequence() {
    const steps = document.querySelectorAll(".scan-step");
    const setStep = (idx: number, status: string, detail?: string) => {
      steps.forEach((el, i) => {
        el.classList.remove("active", "done");
        if (i < idx) el.classList.add("done");
        else if (i === idx) el.classList.add("active");
      });
      if (detail !== undefined) {
        const detailEl = steps[idx]?.querySelector(".step-detail");
        if (detailEl) detailEl.textContent = detail;
      }
      if (status === "active") {
        const marker = steps[idx]?.querySelector(".step-marker");
        if (marker) marker.innerHTML = '<div class="spinner"></div>';
      } else if (status === "done") {
        const marker = steps[idx]?.querySelector(".step-marker");
        if (marker) marker.innerHTML = "✓";
      }
    };
    const finishStep = (idx: number, detail?: string) => {
      steps[idx].classList.remove("active");
      steps[idx].classList.add("done");
      const marker = steps[idx].querySelector(".step-marker");
      if (marker) marker.innerHTML = "✓";
      if (detail) {
        const detailEl = steps[idx].querySelector(".step-detail");
        if (detailEl) detailEl.textContent = detail;
      }
    };

    setStep(0, "active", "reading…");
    setSpeech(`Alright, I'm pulling up ${hostnameOf(state.url)} now. Let me see what we're working with.`);
    // Wait for the parallel extract to settle before announcing the trade area
    // — but never block longer than the read animation itself, so the funnel
    // can't stall on a slow extractor.
    await Promise.race([
      state.extractPromise ?? Promise.resolve(),
      wait(900),
    ]);
    await state.extractPromise?.catch(() => {});
    finishStep(0, hostnameOf(state.url));

    const cityLabel = state.city || "your area";
    setStep(1, "active", cityLabel.toUpperCase());
    const cityLine = state.city
      ? `Trade area locked in — ${state.city}.`
      : `Couldn't pin the city from your site, so I'm going on neutral trade-area math.`;
    const makeLine = state.make !== "automotive"
      ? ` Looks like a ${state.make.charAt(0).toUpperCase() + state.make.slice(1)} store.`
      : "";
    setSpeech(`${cityLine}${makeLine} Now let's see who's playing for the same shoppers.`);
    await wait(1200);
    finishStep(1, cityLabel);

    setStep(2, "active", "querying SERPs…");
    const competitorPromise = discoverCompetitors(state.make, state.city, state.url);
    setStep(3, "active", "scanning…");
    const yourScoresPromise = computeAlgoScores(state.url);

    const competitors = await competitorPromise;
    state.competitorUrls = competitors;
    if (competitors.length === 0) {
      const seedHosts = [
        `${state.make}of${state.city.split(",")[0].replace(/\s+/g, "").toLowerCase()}.com`,
        `${state.city.split(",")[0].replace(/\s+/g, "").toLowerCase()}${state.make}.com`,
        `north${state.make}.com`,
      ];
      state.competitorUrls = seedHosts.map((h) => "https://" + h);
      finishStep(2, `${state.competitorUrls.length} found · estimated`);
      setSpeech(`Search engines were stingy today — I'm running on estimated rooftops for your area. Real numbers come on the strategy call.`);
    } else {
      finishStep(2, `${competitors.length} found`);
      setSpeech(`Got 'em. ${competitors.length} ${state.make} rooftops fighting for the same trade area as you. Now let's see who's actually winning.`);
    }
    await wait(800);

    let yourScores;
    try { yourScores = await yourScoresPromise; }
    catch { yourScores = computeAlgoScoresSeeded(state.url); }
    state.yourScores = yourScores;
    finishStep(3, `${yourScores.total}/60`);

    setStep(4, "active", "0 / " + state.competitorUrls.length);
    const compResults: any[] = [];
    let done = 0;
    await Promise.all(state.competitorUrls.map(async (u: string) => {
      const scores = await computeAlgoScores(u);
      compResults.push({ url: u, host: hostnameOf(u), scores });
      done++;
      setStep(4, "active", `${done} / ${state.competitorUrls.length}`);
    }));
    compResults.sort((a, b) => b.scores.total - a.scores.total);
    state.competitorScores = compResults;
    finishStep(4, `${compResults.length} scored`);

    setStep(5, "active", "crunching…");
    setSpeech(`Now for the part that stings — let me calculate what these rankings are costing you every month.`);
    await wait(1200);
    const dmg = calculateDamage(state.yourScores, state.competitorScores);
    state.monthlyDamage = dmg.damage;
    state.monthlyLostLeads = dmg.lostLeads;
    state.monthlyLostClicks = dmg.lostClicks;
    state.yourEstimatedRank = dmg.yourRank;
    state.damageDetail = dmg;
    finishStep(5, `$${dmg.damage.toLocaleString()} / mo`);

    state.scanComplete = true;

    $("leadCompCount")!.textContent = String(state.competitorScores.filter((c: any) => c.scores.total > state.yourScores.total).length || state.competitorScores.length);
    if (dmg.damage > 0) {
      $("leadPreview")!.removeAttribute("hidden");
      $("leadPreviewStat")!.textContent = "$" + dmg.damage.toLocaleString();
    }

    setSpeech(`Audit's locked. The breakdown's not pretty in spots but every one of these is fixable. Drop your info — I'll send you the full report.`);
    await wait(900);
    if (document.body.classList.contains("sales-view")) {
      try { renderResult(); } catch (err) { console.error("renderResult threw — falling back to minimal reveal:", err); renderResultMinimal(); }
      show("screen-result");
      return;
    }
    show("screen-leadcap");
  }

  function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

  // ============================================================
  //   LEAD CAPTURE → RESULT REVEAL
  // ============================================================
  function setLeadError(msg: string) {
    const el = $("leadError");
    if (el) el.textContent = msg || "";
  }
  function validEmail(s: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  }
  function validPhone(s: string) {
    return (s.match(/\d/g) || []).length >= 10;
  }

  $("leadForm")?.addEventListener("submit", async (e: any) => {
    e.preventDefault();
    setLeadError("");

    const name   = ($("leadName") as HTMLInputElement).value.trim();
    const dealer = ($("leadDealer") as HTMLInputElement).value.trim();
    const email  = ($("leadEmail") as HTMLInputElement).value.trim();
    const phone  = ($("leadPhone") as HTMLInputElement).value.trim();
    if (!name)            { setLeadError("Drop your name in so we know who to send this to."); ($("leadName") as HTMLInputElement).focus(); return; }
    if (!dealer)          { setLeadError("Add the dealership name."); ($("leadDealer") as HTMLInputElement).focus(); return; }
    if (!validEmail(email)){ setLeadError("That email doesn't look right. Double-check it."); ($("leadEmail") as HTMLInputElement).focus(); return; }
    if (!validPhone(phone)){ setLeadError("Need a 10-digit phone number."); ($("leadPhone") as HTMLInputElement).focus(); return; }

    const hp = $("leadHoneypot") as HTMLInputElement | null;
    const botSuspected = !!(hp && hp.value.trim());
    if (botSuspected) console.warn("Honeypot tripped — skipping GHL POST.");

    if (!state.yourScores) {
      console.warn("state.yourScores missing at submit — using seeded fallback for", state.url);
      state.yourScores = computeAlgoScoresSeeded(state.url || "https://unknown");
    }
    if (!Array.isArray(state.competitorScores) || state.competitorScores.length === 0) {
      console.warn("state.competitorScores empty at submit — seeding placeholders");
      state.competitorScores = [
        { url: "#", host: "competitor-1.local", scores: computeAlgoScoresSeeded("seed-1") },
        { url: "#", host: "competitor-2.local", scores: computeAlgoScoresSeeded("seed-2") },
        { url: "#", host: "competitor-3.local", scores: computeAlgoScoresSeeded("seed-3") },
      ];
    }
    if (!state.damageDetail) {
      console.warn("state.damageDetail missing at submit — recalculating");
      state.damageDetail = calculateDamage(state.yourScores, state.competitorScores);
      state.monthlyDamage = state.damageDetail.damage;
      state.monthlyLostLeads = state.damageDetail.lostLeads;
      state.monthlyLostClicks = state.damageDetail.lostClicks;
      state.yourEstimatedRank = state.damageDetail.yourRank;
    }

    const submitBtn = $("leadSubmitBtn") as HTMLButtonElement | null;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Locking it in…"; }

    const payload = {
      audit_type: "outrank",
      name, dealership: dealer, email, phone,
      url: state.url,
      city: state.city,
      cityConfidence: state.cityConfidence ?? undefined,
      make: state.make,
      goal: state.goal,
      rival: state.rival,
      yourScores: state.yourScores,
      competitorScores: state.competitorScores.map((c: any) => ({ host: c.host, ...c.scores })),
      estimatedRank: state.yourEstimatedRank,
      monthlyLostClicks: state.monthlyLostClicks,
      monthlyLostLeads: state.monthlyLostLeads,
      monthlyDamage: state.monthlyDamage,
      timestamp: new Date().toISOString(),
    };
    console.log("Outrank Audit Lead Payload →", payload);

    // Persist the lead to our own backend so sales reps can see it on any device.
    // GHL fires only AFTER this succeeds so duplicates don't spam the pipeline.
    let savedOk = botSuspected;
    if (!botSuspected) {
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        if (res.status === 409) {
          const body = await res.json().catch(() => ({}));
          const field = body?.field;
          const which = field === "email" ? "email" : field === "name" ? "name" : "user or email";
          setLeadError(`That ${which} already exists — try another.`);
          const focusId = field === "name" ? "leadName" : "leadEmail";
          ($(focusId) as HTMLInputElement | null)?.focus();
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Reveal The Leaderboard →"; }
          return;
        }
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          console.warn("Lead save failed:", res.status, detail);
        } else {
          savedOk = true;
          renderSubmissionsTable().catch(() => {});
        }
      } catch (err) {
        console.warn("Lead save threw:", err);
      }
    }

    if (savedOk && !botSuspected && GHL_WEBHOOK_URL && !/PASTE_YOUR/i.test(GHL_WEBHOOK_URL)) {
      try {
        fetch(GHL_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          mode: "cors",
          keepalive: true,
        }).catch((err) => console.warn("GHL webhook failed:", err));
      } catch (err) {
        console.warn("GHL webhook threw synchronously:", err);
      }
    }

    try {
      renderResult();
    } catch (err) {
      console.error("renderResult threw — falling back to minimal reveal:", err);
      renderResultMinimal();
    }
    show("screen-result");

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Reveal The Leaderboard →"; }
  });

  function renderResultMinimal() {
    try {
      const dmg = state.damageDetail || { damage: 0, yourRank: "?", lostClicks: 0, lostLeads: 0, tradeAreaVolume: DEFAULT_TRADE_AREA_VOLUME, lostShare: 0 };
      const you = state.yourScores  || { seo: 0, aeo: 0, geo: 0, total: 0 };
      $("bandName")!.textContent = "Report Ready";
      $("damageVerdict")!.innerHTML = "Saggy's report is below. (Rendering hit a snag — check the console for details; the numbers are still real.)";
      $("damageVal")!.textContent = Number(dmg.damage || 0).toLocaleString();
      $("lbTrade")!.textContent = "Trade area · " + (state.city || "—");
      const lb = $("lbBody")!; lb.innerHTML = "";
      const rows = [
        ...(state.competitorScores || []).map((c: any) => ({ host: c.host, t: c.scores.total, isYou: false })),
        { host: hostnameOf(state.url || ""), t: you.total, isYou: true },
      ].sort((a, b) => b.t - a.t);
      rows.forEach((r: any, i: number) => {
        const div = document.createElement("div");
        div.className = "lb-row " + (r.isYou ? "you" : "") + " rank-" + (i + 1);
        div.innerHTML = '<div class="lb-rank">' + (i + 1) + '</div><div class="lb-domain"><div class="host">' + r.host + '</div></div><div class="lb-score">' + r.t + '<small>/60</small></div><div class="lb-gap">' + (i === 0 ? "#1" : "−" + (rows[0].t - r.t) + " pts") + "</div>";
        lb.appendChild(div);
      });
      $("gapGrid")!.innerHTML = "";
      $("costRows")!.innerHTML = '<div class="cost-row total"><div class="cost-label">Estimated monthly damage</div><div class="cost-val">$' + Number(dmg.damage || 0).toLocaleString() + "</div></div>";
      $("fixesTitle")!.textContent = "Book the call to walk through it";
      $("fixesList")!.innerHTML = '<li class="fix-item"><div><div class="fix-topic">Strategy Call</div><div class="fix-body">The full gap analysis and fix plan is best walked through live. Book a 20-minute slot below.</div></div></li>';
    } catch (err) {
      console.error("Even the minimal renderer failed:", err);
    }
  }

  function bandFor(yourTotal: number) {
    const pct = (yourTotal / 60) * 100;
    return BANDS.find((b) => pct >= b.min) || BANDS[BANDS.length - 1];
  }

  function renderResult() {
    const you = state.yourScores;
    const comps = Array.isArray(state.competitorScores) ? state.competitorScores : [];
    const dmg = state.damageDetail;
    if (!you || !dmg) {
      throw new Error("renderResult called before state was ready");
    }

    const band = bandFor(you.total);
    $("bandName")!.textContent = band.name;
    const topComp = comps[0] || { host: "a competitor" };
    $("damageVerdict")!.innerHTML = band.verdict(0, escapeHTML(topComp.host));

    animateCount("damageVal", 0, dmg.damage || 0, 1600, (v) => v.toLocaleString());

    const safeCity = escapeHTML(state.city || "—");
    const safeMake = escapeHTML(state.make || "");
    $("lbTrade")!.innerHTML = `Trade area · <b>${safeCity}</b>${state.make && state.make !== "automotive" ? ` · <b>${safeMake.charAt(0).toUpperCase() + safeMake.slice(1)}</b>` : ""}`;

    const lb = $("lbBody")!;
    lb.innerHTML = "";
    const allRows = [
      { host: hostnameOf(state.url), scores: you, isYou: true },
      ...comps.map((c: any) => ({ host: c.host, scores: c.scores, isYou: false })),
    ].sort((a, b) => b.scores.total - a.scores.total);

    allRows.forEach((row: any, i: number) => {
      const rank = i + 1;
      const gap = i === 0 ? 0 : allRows[0].scores.total - row.scores.total;
      const li = document.createElement("div");
      li.className = `lb-row ${row.isYou ? "you" : ""} rank-${rank}`;
      li.innerHTML = `
        <div class="lb-rank">${rank}</div>
        <div class="lb-domain">
          <div class="host">${escapeHTML(row.host)}</div>
          <div class="pillars">
            <span>SEO<b>${row.scores.seo}</b></span>
            <span>AEO<b>${row.scores.aeo}</b></span>
            <span>GEO<b>${row.scores.geo}</b></span>
          </div>
        </div>
        <div class="lb-score">${row.scores.total}<small>/60</small></div>
        <div class="lb-gap">${rank === 1 ? "#1" : "−" + gap + " pts"}</div>
      `;
      lb.appendChild(li);
    });

    const gapGrid = $("gapGrid")!;
    gapGrid.innerHTML = "";
    comps.slice(0, 3).forEach((c: any) => {
      const beats: string[] = [];
      if (c.scores.seo > you.seo) beats.push(`SEO by ${c.scores.seo - you.seo}`);
      if (c.scores.aeo > you.aeo) beats.push(`AEO by ${c.scores.aeo - you.aeo}`);
      if (c.scores.geo > you.geo) beats.push(`GEO by ${c.scores.geo - you.geo}`);
      const eyebrow = beats.length === 0 ? `You're ahead here` : `Beats you on ${beats.join(", ")}`;

      const card = document.createElement("div");
      card.className = "gap-card";
      card.innerHTML = `
        <div class="gap-card-eyebrow">${eyebrow}</div>
        <div class="gap-card-title">${escapeHTML(c.host)}</div>
        <div class="gap-bars">
          ${renderGapBar("SEO", you.seo, c.scores.seo)}
          ${renderGapBar("AEO", you.aeo, c.scores.aeo)}
          ${renderGapBar("GEO", you.geo, c.scores.geo)}
        </div>
      `;
      gapGrid.appendChild(card);
    });
    requestAnimationFrame(() => {
      document.querySelectorAll(".gap-fill").forEach((el: any) => {
        const w = el.getAttribute("data-w");
        if (w) el.style.width = w + "%";
      });
    });

    const cost = $("costRows")!;
    const safeMakeForCost = escapeHTML(state.make || "automotive");
    const safeCityForCost = escapeHTML(state.city || "");
    cost.innerHTML = `
      <div class="cost-row">
        <div class="cost-label">Your estimated SERP rank in trade area<small>Based on composite SAGGY score</small></div>
        <div class="cost-val">#${dmg.yourRank}</div>
      </div>
      <div class="cost-row">
        <div class="cost-label">Monthly searches for "${safeMakeForCost} dealer ${safeCityForCost}"<small>Conservative trade-area estimate</small></div>
        <div class="cost-val">${dmg.tradeAreaVolume.toLocaleString()}</div>
      </div>
      <div class="cost-row">
        <div class="cost-label">Click-share you're losing to higher ranks<small>CTR(#1) − CTR(#${dmg.yourRank})</small></div>
        <div class="cost-val">${Math.round(dmg.lostShare * 100)}%</div>
      </div>
      <div class="cost-row">
        <div class="cost-label">Lost organic clicks per month<small>Search volume × lost click-share</small></div>
        <div class="cost-val">${dmg.lostClicks.toLocaleString()}</div>
      </div>
      <div class="cost-row">
        <div class="cost-label">Lost organic leads per month<small>Clicks × 3% organic-to-lead conversion</small></div>
        <div class="cost-val">${dmg.lostLeads.toLocaleString()}</div>
      </div>
      <div class="cost-row total">
        <div class="cost-label">What you're paying somewhere else<small>Lost leads × $${CPL_BENCHMARK} automotive CPL benchmark</small></div>
        <div class="cost-val">$${dmg.damage.toLocaleString()}<span style="font-size:13px;color:var(--gray-warm);font-weight:400"> / mo</span></div>
      </div>
    `;

    renderFixes();

    setTimeout(() => saggySpeak(`Estimated monthly damage: ${dmg.damage.toLocaleString()} dollars. ${band.name}.`), 400);
  }

  function renderGapBar(label: string, yours: number, theirs: number) {
    const max = 20;
    const youPct = Math.max(2, (yours / max) * 100);
    const compPct = Math.max(2, (theirs / max) * 100);
    return `
      <div class="gap-bar-row you"><span class="gap-label">You</span><span class="gap-val">${yours}</span></div>
      <div class="gap-track"><div class="gap-fill you" data-w="${youPct}"></div></div>
      <div class="gap-bar-row"><span class="gap-label">Them</span><span class="gap-val">${theirs}</span></div>
      <div class="gap-track"><div class="gap-fill comp" data-w="${compPct}"></div></div>
    `;
  }

  function renderFixes() {
    const you = state.yourScores;
    const topComp = state.competitorScores[0];
    if (!topComp) {
      $("fixesTitle")!.textContent = "Your trade area's wide open.";
      $("fixesList")!.innerHTML = `<li class="fix-item"><div><div class="fix-topic">No Competitors Identified</div><div class="fix-body">We couldn't pull a clean competitor set from public search for your area. The strategy call gets you a manual trade-area pull from real CRM and DataForSEO data.</div></div></li>`;
      return;
    }
    const safeHost = escapeHTML(topComp.host);
    const safeMake = escapeHTML(state.make || "automotive");
    const safeCity = escapeHTML(state.city || "your trade area");
    const gaps = [
      { pillar: "SEO", gap: topComp.scores.seo - you.seo, fix: `<b>Fix the SEO gap.</b> ${safeHost} is winning the traditional ranking signals — title tags, internal linking, on-page targeting, Core Web Vitals, schema. We close this by re-architecting your model pages and city pages around the queries shoppers actually use in ${safeCity}.` },
      { pillar: "AEO", gap: topComp.scores.aeo - you.aeo, fix: `<b>Win the answer engines.</b> When a shopper asks ChatGPT, Perplexity, or Gemini "best ${safeMake} dealer in ${safeCity}", ${safeHost} is showing up and you aren't. We fix that with structured FAQ content, entity SEO, and citation-shaped pages that LLMs actually pull from.` },
      { pillar: "GEO", gap: topComp.scores.geo - you.geo, fix: `<b>Get cited in AI Overviews.</b> Google's generative results are pulling competitors into the AI box above the organic list — that's free real estate you're invisible in. We fix this with crawlable, structured, citation-ready content built for the GALAXY framework.` },
    ].filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap);

    const list = $("fixesList")!;
    list.innerHTML = "";

    if (gaps.length === 0) {
      $("fixesTitle")!.textContent = "You're already ahead on the pillars.";
      const li = document.createElement("li");
      li.className = "fix-item";
      li.innerHTML = `<div><div class="fix-topic">Trade Area Lead</div><div class="fix-body">You're outscoring ${safeHost} on every pillar. Rare. Now we widen the lead before they catch up — that's the strategy call.</div></div>`;
      list.appendChild(li);
      return;
    }

    $("fixesTitle")!.textContent = gaps.length === 1 ? "Your Biggest Gap" : `Your Top ${Math.min(3, gaps.length)} Gaps`;
    gaps.slice(0, 3).forEach((g) => {
      const li = document.createElement("li");
      li.className = "fix-item";
      li.innerHTML = `<div><div class="fix-topic">${g.pillar} · ${g.gap} point gap</div><div class="fix-body">${g.fix}</div></div>`;
      list.appendChild(li);
    });
  }

  function animateCount(elId: string, from: number, to: number, durationMs: number, formatter?: (v: number) => string) {
    const el = $(elId)!;
    const startTime = performance.now();
    const fmt = formatter || ((v: number) => String(v));
    function frame(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ============================================================
  //   CTAs
  // ============================================================
  $("ctaBook")?.addEventListener("click", () => { window.open(BOOK_CALL_URL, "_blank"); });
  $("ctaEmail")?.addEventListener("click", () => {
    const name = ($("leadName") as HTMLInputElement)?.value.trim() || "there";
    const dealer = ($("leadDealer") as HTMLInputElement)?.value.trim() || "";
    const leadEmail = ($("leadEmail") as HTMLInputElement)?.value.trim() || "";
    const you = state.yourScores;
    const dmg = state.damageDetail;

    const subject = `Your Outrank Audit — $${dmg.damage.toLocaleString()}/mo gap`;
    const lines = [
      `Hi ${name},`, ``,
      `Here's your Outrank Audit${dealer ? " for " + dealer : ""}.`,
      `Site analyzed: ${state.url}`,
      `Trade area:    ${state.city}`,
      `Make detected: ${state.make}`, ``,
      `═══════════════════════`,
      `ESTIMATED MONTHLY DAMAGE:  $${dmg.damage.toLocaleString()}`,
      `Your estimated SERP rank:  #${dmg.yourRank}`,
      `Lost clicks/month:         ${dmg.lostClicks.toLocaleString()}`,
      `Lost leads/month:          ${dmg.lostLeads.toLocaleString()}`,
      `═══════════════════════`, ``,
      `Your composite score: ${you.total}/60`,
      `  • SEO:  ${you.seo}/20`,
      `  • AEO:  ${you.aeo}/20`,
      `  • GEO:  ${you.geo}/20`, ``,
      `Rooftops ahead of you:`,
    ];
    state.competitorScores.forEach((c: any, i: number) => {
      lines.push(`  ${i + 1}. ${c.host} — ${c.scores.total}/60  (SEO ${c.scores.seo} · AEO ${c.scores.aeo} · GEO ${c.scores.geo})`);
    });
    lines.push(``,
      `Want to close the gap? Book a strategy call:`,
      BOOK_CALL_URL, ``,
      `— A3 Brands · GALAXY Outrank Audit`,
    );
    const body = lines.join("\n");
    const href = `mailto:${encodeURIComponent(leadEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  });

  // User-activity log. Today: fetched from /api/leads (JSON file on the server).
  // Phase 2.5: swap storage.ts for Supabase and nothing here changes.
  let _leadsCache: any[] = [];
  let _leadsFilter: string = "";
  let _leadsPage: number = 0;
  const PAGE_SIZE = 10;

  // Sales-console secret. Captured from ?key=... in initViewMode and sent on
  // every privileged /api/leads call so the (now auth-gated) endpoint answers.
  // The public funnel never touches this — only the read/clear/status views do.
  let _salesToken = "";
  function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return _salesToken ? { Authorization: "Bearer " + _salesToken, ...extra } : { ...extra };
  }

  function filterLeads(query: string, leads: any[]): any[] {
    const q = (query || "").trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead: any) => {
      let host = "";
      try { host = new URL(lead.url || "").hostname.replace(/^www\./, "").toLowerCase(); } catch {}
      const hay = [
        lead.name, lead.dealership, lead.email, lead.phone,
        lead.url, host, lead.city, lead.make, lead.status,
      ].map((v: any) => (v == null ? "" : String(v).toLowerCase())).join(" ");
      return hay.includes(q);
    });
  }

  async function fetchLeads(): Promise<any[]> {
    try {
      const res = await fetch("/api/leads", { cache: "no-store", headers: authHeaders() });
      if (!res.ok) {
        if (res.status === 401) console.warn("Lead fetch unauthorized — add ?key=<ADMIN_TOKEN> to the sales URL.");
        else console.warn("Lead fetch failed:", res.status);
        return [];
      }
      const data = await res.json();
      return Array.isArray(data.leads) ? data.leads : [];
    } catch (err) {
      console.warn("Lead fetch threw:", err);
      return [];
    }
  }

  async function clearLeadsRemote(): Promise<void> {
    try {
      const res = await fetch("/api/leads", { method: "DELETE", headers: authHeaders() });
      if (!res.ok) console.warn("Lead clear failed:", res.status);
    } catch (err) {
      console.warn("Lead clear threw:", err);
    }
  }

  function formatSubmissionTime(ts: number) {
    if (!ts) return "—";
    const d = new Date(ts);
    const diff = Date.now() - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const _escapeHtml = (str: any) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

  function statusPill(status: string) {
    const s = status === "confirmed" || status === "cancelled" ? status : "pending";
    return '<span class="status-pill status-' + s + '">' + s + "</span>";
  }

  function _renderLeadsInto(tbody: HTMLElement | null, leads: any[], { withOpenAction = false, filterActive = false }: { withOpenAction?: boolean; filterActive?: boolean } = {}) {
    if (!tbody) return;
    // Dashboard = 8 cols (#, lead, contact, audit, damage, status, submitted, action)
    // Result-screen recap = 7 cols (no action)
    const colspan = withOpenAction ? 8 : 7;
    if (!leads.length) {
      const msg = filterActive
        ? 'No leads match your search.'
        : 'No leads yet — they will show up here when users complete the audit form.';
      tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="submissions-empty">' + msg + '</td></tr>';
      return;
    }
    tbody.innerHTML = leads.map((lead: any, i: number) => {
      const safeId = _escapeHtml(lead.id || "");
      const safeUrl = _escapeHtml(lead.url || "");
      const host = (() => { try { return new URL(lead.url).hostname.replace(/^www\./, ""); } catch { return lead.url || "—"; } })();
      const safeCity = _escapeHtml(lead.city || "");
      const safeName = _escapeHtml(lead.name || "");
      const safeDealer = _escapeHtml(lead.dealership || "");
      const safeEmail = _escapeHtml(lead.email || "");
      const safePhone = _escapeHtml(lead.phone || "");
      const damage = typeof lead.monthlyDamage === "number" ? "$" + lead.monthlyDamage.toLocaleString() : "—";
      const action = withOpenAction
        ? '<td style="text-align:right;"><button type="button" class="row-menu-trigger" data-lead-id="' + safeId + '" aria-haspopup="menu" aria-label="Open actions" title="Actions"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg></button></td>'
        : "";
      return (
        '<tr data-lead-id="' + safeId + '">' +
          '<td class="col-idx">' + String(i + 1).padStart(2, "0") + "</td>" +
          '<td class="col-lead"><div class="cell-primary">' + (safeName || "—") + "</div><div class=\"cell-secondary\">" + safeDealer + "</div></td>" +
          '<td class="col-contact"><div class="cell-primary"><a href="mailto:' + safeEmail + '">' + safeEmail + "</a></div><div class=\"cell-secondary\">" + safePhone + "</div></td>" +
          '<td class="col-url"><a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + _escapeHtml(host) + "</a><div class=\"cell-secondary\">" + (safeCity || "—") + "</div></td>" +
          '<td class="col-damage">' + damage + "</td>" +
          '<td class="col-status">' + statusPill(lead.status) + "</td>" +
          '<td class="col-ts">' + formatSubmissionTime(lead.ts) + "</td>" +
          action +
        "</tr>"
      );
    }).join("");
  }
  function renderDashboardPagination(total: number, pageStart: number, pageEnd: number, totalPages: number) {
    const nav = document.getElementById("submissionsDashPagination");
    const info = document.getElementById("submissionsDashPagInfo");
    const pageEl = document.getElementById("submissionsDashPagPage");
    const prevBtn = document.getElementById("submissionsDashPagPrev") as HTMLButtonElement | null;
    const nextBtn = document.getElementById("submissionsDashPagNext") as HTMLButtonElement | null;
    if (!nav || !info || !pageEl || !prevBtn || !nextBtn) return;
    if (total <= PAGE_SIZE) {
      nav.setAttribute("hidden", "");
      return;
    }
    nav.removeAttribute("hidden");
    info.textContent = `Showing ${pageStart + 1}–${pageEnd} of ${total}`;
    pageEl.textContent = `${_leadsPage + 1} / ${totalPages}`;
    prevBtn.disabled = _leadsPage <= 0;
    nextBtn.disabled = _leadsPage >= totalPages - 1;
  }

  function renderDashboardOnly() {
    const dashFiltered = filterLeads(_leadsFilter, _leadsCache);
    const filterActive = !!_leadsFilter.trim();
    const total = dashFiltered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (_leadsPage > totalPages - 1) _leadsPage = totalPages - 1;
    if (_leadsPage < 0) _leadsPage = 0;
    const start = _leadsPage * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    const dashPage = dashFiltered.slice(start, end);
    _renderLeadsInto(document.getElementById("submissionsDashBody"), dashPage, { withOpenAction: true, filterActive });
    renderDashboardPagination(total, start, end, totalPages);
  }

  async function renderSubmissionsTable() {
    _leadsCache = await fetchLeads();
    // Result-screen recap stays unpaginated — it's a context view.
    _renderLeadsInto(document.getElementById("submissionsBody"), _leadsCache);
    renderDashboardOnly();
  }
  function runAuditFromRow(url: string, city: string) {
    if (!url) return;
    const urlInput = document.getElementById("urlInput") as HTMLInputElement | null;
    const cityInput = document.getElementById("cityInput") as HTMLInputElement | null;
    if (urlInput) urlInput.value = url;
    if (cityInput) cityInput.value = city || "";
    show("screen-landing");
    setTimeout(() => kickoffAudit(), 0);
  }

  // View mode: ?view=sales boots into the sales console (skipping the lead funnel)
  // and reveals the math + gap + fixes panels on the result page.
  (function initViewMode() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") !== "sales") return;

      // Sales console is now gated server-side. The rep opens it with
      // ?view=sales&key=<ADMIN_TOKEN>; the key is sent as a Bearer token on
      // every privileged /api/leads call. Persist it for this tab so a refresh
      // (which may drop the query string) keeps working.
      const keyParam = (params.get("key") || "").trim();
      if (keyParam) {
        _salesToken = keyParam;
        try { sessionStorage.setItem("salesToken", keyParam); } catch {}
      } else {
        try { _salesToken = sessionStorage.getItem("salesToken") || ""; } catch {}
      }

      document.body.classList.add("sales-view");
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "sales-badge";
      badge.textContent = "← Sales console";
      badge.title = "Back to user-activity dashboard";
      badge.addEventListener("click", () => { renderSubmissionsTable(); show("screen-sales-dash"); });
      document.body.appendChild(badge);

      show("screen-sales-dash");
      renderSubmissionsTable();

      const clearBtn = document.getElementById("submissionsClear");
      if (clearBtn) clearBtn.addEventListener("click", async () => {
        if (!confirm("Clear ALL leads on the server? This affects every sales rep.")) return;
        await clearLeadsRemote();
        await renderSubmissionsTable();
      });

      const newBtn = document.getElementById("salesNewAuditBtn");
      if (newBtn) newBtn.addEventListener("click", () => show("screen-landing"));
      const dashClear = document.getElementById("salesDashClearBtn");
      if (dashClear) dashClear.addEventListener("click", async () => {
        if (!confirm("Clear ALL leads on the server? This affects every sales rep.")) return;
        await clearLeadsRemote();
        await renderSubmissionsTable();
      });

      // Wire the row-action menu (kebab dropdown).
      wireRowMenu();
    } catch (err) { console.warn("Sales view init failed:", err); }
  })();

  // ---- Row menu (kebab dropdown) + lead-details modal ----
  let _menuOpenForId: string | null = null;
  function getMenuEl() { return document.getElementById("rowMenu"); }
  function closeRowMenu() {
    const m = getMenuEl(); if (!m) return;
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
    _menuOpenForId = null;
  }
  function openRowMenu(btn: HTMLElement, leadId: string) {
    const m = getMenuEl(); if (!m) return;
    m.dataset.leadId = leadId;
    _menuOpenForId = leadId;
    // Show first to measure
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
    // Position fixed near the button. Anchor right-edge of button to right-edge of menu.
    const rect = btn.getBoundingClientRect();
    const menuRect = m.getBoundingClientRect();
    const top = Math.min(rect.bottom + 6, window.innerHeight - menuRect.height - 8);
    const right = Math.max(8, window.innerWidth - rect.right);
    m.style.top = top + "px";
    m.style.right = right + "px";
    m.style.left = "auto";
  }

  async function setLeadStatus(leadId: string, status: "pending" | "confirmed" | "cancelled") {
    try {
      const res = await fetch("/api/leads/" + encodeURIComponent(leadId), {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        console.warn("Status update failed:", res.status);
        return;
      }
      await renderSubmissionsTable();
    } catch (err) {
      console.warn("Status update threw:", err);
    }
  }

  function openLeadModal(leadId: string) {
    const lead = _leadsCache.find((l: any) => l.id === leadId);
    if (!lead) return;
    const modal = document.getElementById("leadModal");
    const body = document.getElementById("leadModalBody");
    if (!modal || !body) return;

    const safe = (v: any) => _escapeHtml(v ?? "");
    const host = (() => { try { return new URL(lead.url).hostname.replace(/^www\./, ""); } catch { return lead.url || "—"; } })();
    const submittedDate = new Date(lead.ts);
    const submittedRel = formatSubmissionTime(lead.ts);
    const submittedAbs = submittedDate.toLocaleString();
    const damage = typeof lead.monthlyDamage === "number" ? "$" + lead.monthlyDamage.toLocaleString() : null;
    const you = lead.yourScores || {};
    const comps = Array.isArray(lead.competitorScores) ? lead.competitorScores : [];
    const safeName = safe(lead.name || lead.email || "Lead");
    const safeDealer = safe(lead.dealership || "");
    const safeEmail = safe(lead.email || "");
    const safePhone = safe(lead.phone || "");
    const safeUrl = safe(lead.url || "");

    const pillarBar = (label: string, score: any, key: string) => {
      const n = Number(score);
      const valid = Number.isFinite(n);
      const pct = valid ? Math.max(0, Math.min(100, (n / 20) * 100)) : 0;
      const display = valid ? n : "—";
      return (
        '<div class="modal-pillar">' +
          '<div class="modal-pillar-head">' +
            '<span class="modal-pillar-label">' + label + '</span>' +
            '<span class="modal-pillar-value">' + display + '<small>/20</small></span>' +
          '</div>' +
          '<div class="modal-pillar-track"><div class="modal-pillar-fill modal-pillar-' + key + '" style="width:' + pct + '%"></div></div>' +
        '</div>'
      );
    };

    const compList = comps.length
      ? '<ul class="modal-comp-list">' + comps.map((c: any, i: number) => {
          const total = (Number(c.seo) || 0) + (Number(c.aeo) || 0) + (Number(c.geo) || 0);
          return (
            '<li class="modal-comp-row">' +
              '<span class="modal-comp-rank">#' + (i + 1) + '</span>' +
              '<span class="modal-comp-host">' + safe(c.host || "—") + '</span>' +
              '<span class="modal-comp-scores"><span>SEO <b>' + safe(c.seo) + '</b></span><span>AEO <b>' + safe(c.aeo) + '</b></span><span>GEO <b>' + safe(c.geo) + '</b></span></span>' +
              '<span class="modal-comp-total">' + total + '<small>/60</small></span>' +
            '</li>'
          );
        }).join("") + "</ul>"
      : '<div class="modal-empty">No competitors recorded</div>';

    const tradeArea = safe(lead.city || "—") + (lead.make ? ' · <b>' + safe(lead.make) + '</b>' : "");

    body.innerHTML =
      // === HERO ===
      '<div class="modal-hero">' +
        '<div class="modal-hero-main">' +
          '<div class="modal-hero-name">' + safeName + '</div>' +
          (safeDealer ? '<div class="modal-hero-dealer">' + safeDealer + '</div>' : '') +
        '</div>' +
        '<div class="modal-hero-status">' + statusPill(lead.status) + '</div>' +
      '</div>' +

      // === CONTACT ROW ===
      '<div class="modal-contact-row">' +
        (safeEmail ?
          '<a class="modal-contact-item" href="mailto:' + safeEmail + '">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>' +
            '<span>' + safeEmail + '</span>' +
          '</a>' : '') +
        (safePhone ?
          '<a class="modal-contact-item" href="tel:' + safePhone + '">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z"/></svg>' +
            '<span>' + safePhone + '</span>' +
          '</a>' : '') +
        (safeUrl ?
          '<a class="modal-contact-item" href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>' +
            '<span>' + safe(host) + '</span>' +
          '</a>' : '') +
      '</div>' +

      // === BIG STAT CARDS ===
      '<div class="modal-stats-row">' +
        '<div class="modal-stat-card modal-stat-damage">' +
          '<div class="modal-stat-label">Estimated Monthly Damage</div>' +
          '<div class="modal-stat-value">' + (damage || '<span class="modal-stat-dim">—</span>') + '</div>' +
          '<div class="modal-stat-sub">' + (damage ? 'per month · lost leads × $80 CPL' : 'not calculated') + '</div>' +
        '</div>' +
        '<div class="modal-stat-card modal-stat-score">' +
          '<div class="modal-stat-label">Saggy Composite</div>' +
          '<div class="modal-stat-value">' + safe(you.total ?? "—") + '<small>/60</small></div>' +
          '<div class="modal-stat-sub">' + (lead.estimatedRank ? 'Rank <b>#' + safe(lead.estimatedRank) + '</b> in trade area' : 'rank n/a') + '</div>' +
        '</div>' +
      '</div>' +

      // === PILLAR SCORES ===
      '<div class="modal-section">' +
        '<div class="modal-section-label">Pillar Scores</div>' +
        '<div class="modal-pillars">' +
          pillarBar("SEO", you.seo, "seo") +
          pillarBar("AEO", you.aeo, "aeo") +
          pillarBar("GEO", you.geo, "geo") +
        '</div>' +
      '</div>' +

      // === AUDIT CONTEXT ===
      '<div class="modal-section">' +
        '<div class="modal-section-label">Audit Context</div>' +
        '<dl class="modal-kv">' +
          '<div class="modal-kv-row"><dt>Trade area</dt><dd>' + tradeArea + '</dd></div>' +
          '<div class="modal-kv-row"><dt>Lost clicks / mo</dt><dd>' + safe(lead.monthlyLostClicks ?? "—") + '</dd></div>' +
          '<div class="modal-kv-row"><dt>Lost leads / mo</dt><dd>' + safe(lead.monthlyLostLeads ?? "—") + '</dd></div>' +
          '<div class="modal-kv-row"><dt>Submitted</dt><dd>' + safe(submittedRel) + ' <span class="modal-kv-dim">· ' + safe(submittedAbs) + '</span></dd></div>' +
        '</dl>' +
      '</div>' +

      // === COMPETITORS ===
      '<div class="modal-section">' +
        '<div class="modal-section-label">Competitors <span class="modal-section-count">' + comps.length + '</span></div>' +
        compList +
      '</div>' +

      // === FOOTER ===
      '<div class="modal-id">Lead ID · ' + safe(lead.id) + '</div>';

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeLeadModal() {
    const modal = document.getElementById("leadModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function wireRowMenu() {
    const dashBody = document.getElementById("submissionsDashBody");
    if (dashBody) {
      dashBody.addEventListener("click", (e: any) => {
        // Don't hijack actual <a> clicks (mailto, site links).
        if (e.target.closest("a")) return;
        const trigger = e.target.closest(".row-menu-trigger");
        if (!trigger) return;
        e.stopPropagation();
        const leadId = trigger.dataset.leadId;
        if (!leadId) return;
        if (_menuOpenForId === leadId) {
          closeRowMenu();
          return;
        }
        openRowMenu(trigger, leadId);
      });
    }

    // Menu item clicks
    const menu = getMenuEl();
    if (menu) {
      menu.addEventListener("click", (e: any) => {
        const item = e.target.closest(".row-menu-item");
        if (!item) return;
        const leadId = menu.dataset.leadId;
        const action = item.dataset.action;
        closeRowMenu();
        if (!leadId || !action) return;
        if (action === "view") {
          openLeadModal(leadId);
        } else if (action === "status-pending") {
          setLeadStatus(leadId, "pending");
        } else if (action === "status-confirmed") {
          setLeadStatus(leadId, "confirmed");
        } else if (action === "status-cancelled") {
          setLeadStatus(leadId, "cancelled");
        }
      });
    }

    // Dismiss menu on outside click / Escape / scroll-away
    document.addEventListener("click", (e: any) => {
      if (!_menuOpenForId) return;
      if (e.target.closest("#rowMenu") || e.target.closest(".row-menu-trigger")) return;
      closeRowMenu();
    });
    document.addEventListener("keydown", (e: any) => {
      if (e.key === "Escape") { closeRowMenu(); closeLeadModal(); }
    });
    window.addEventListener("scroll", () => { if (_menuOpenForId) closeRowMenu(); }, { passive: true });

    // Modal close behaviour
    const modal = document.getElementById("leadModal");
    if (modal) {
      modal.addEventListener("click", (e: any) => {
        if (e.target.closest("[data-close='1']") || e.target === modal) closeLeadModal();
      });
    }

    // Dashboard search wiring
    const searchInput = document.getElementById("salesSearchInput") as HTMLInputElement | null;
    const searchClear = document.getElementById("salesSearchClear") as HTMLButtonElement | null;
    const applySearch = () => {
      _leadsFilter = searchInput ? searchInput.value : "";
      if (searchClear) searchClear.hidden = !_leadsFilter.trim();
      // Filter change always resets to the first page so the rep sees the most recent matches.
      _leadsPage = 0;
      renderDashboardOnly();
    };
    if (searchInput) {
      searchInput.addEventListener("input", applySearch);
      searchInput.addEventListener("keydown", (e: any) => {
        if (e.key === "Escape" && _leadsFilter) { searchInput.value = ""; applySearch(); }
      });
    }
    if (searchClear) {
      searchClear.addEventListener("click", () => {
        if (!searchInput) return;
        searchInput.value = "";
        applySearch();
        searchInput.focus();
      });
    }

    // Pagination wiring
    const pagPrev = document.getElementById("submissionsDashPagPrev");
    const pagNext = document.getElementById("submissionsDashPagNext");
    if (pagPrev) pagPrev.addEventListener("click", () => {
      if (_leadsPage > 0) { _leadsPage--; renderDashboardOnly(); }
    });
    if (pagNext) pagNext.addEventListener("click", () => {
      const total = filterLeads(_leadsFilter, _leadsCache).length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (_leadsPage < totalPages - 1) { _leadsPage++; renderDashboardOnly(); }
    });
  }

  // Init
  updateStepIndicator("screen-landing");
  initAudioToggle();
  document.addEventListener("visibilitychange", () => { if (document.hidden) saggyStop(); });
  window.addEventListener("beforeunload", saggyStop);
}
