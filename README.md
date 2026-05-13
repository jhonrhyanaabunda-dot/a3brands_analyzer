# The Outrank Audit — A3 Brands Saggy Quiz

A self-contained, single-file HTML lead-gen audit for automotive dealers. Drop a dealership URL → Saggy (the mascot) audits the site against trade-area competitors → spits out a SAGGY composite score (SEO + AEO + GEO, each scored 0-20), a leaderboard, and an estimated monthly revenue loss.

Currently lives in [`index.html`](index.html). The whole experience — markup, CSS, JS, and the embedded A3 logo — ships as one file. The mascot is the only external asset.

## Quick start

```bash
# Just open it in a browser. No build, no server, no dependencies.
open index.html
```

For local development with hot reload, any static server works:

```bash
python3 -m http.server 8080   # then http://localhost:8080
```

## File map

| File | Purpose |
|---|---|
| [`index.html`](index.html) | The entire app — markup, ~1100 lines of CSS, ~900 lines of JS. |
| [`saggy_mascot.webm`](saggy_mascot.webm) | Animated mascot with VP9 alpha. Plays in Chrome / Firefox / Edge. |
| [`saggy_mascot.webp`](saggy_mascot.webp) | Animated WebP fallback for Safari (referenced as the `<img>` inside `<video>`). |
| [`mascot try.mov`](mascot%20try.mov) | Source ProRes 4444 with 12-bit alpha. Re-encode from this if you want to refresh the assets. |
| [`a3brands-1.png`](a3brands-1.png) | Original logo (also embedded as base64 inside `index.html`). |
| [`head saggy.png`](head%20saggy.png) | Static mascot used in the damage-hero section and a few small spots. |

## Configuration knobs

All the dials live near the top of the `<script>` block in `index.html`, around line 1354:

```js
const PSI_API_KEY            = '';              // optional Google PageSpeed Insights key
const GHL_WEBHOOK_URL        = 'PASTE_...';     // GoHighLevel (or any) webhook for lead capture
const BOOK_CALL_URL          = 'https://a3brands.com/galaxy/book-call';
const CPL_BENCHMARK          = 80;              // $/lead — A3 automotive benchmark
const LEAD_CONVERSION_RATE   = 0.03;            // organic-click → lead conversion
const DEFAULT_TRADE_AREA_VOLUME = 1800;         // assumed monthly searches per dealer trade area
const CTR_BY_RANK = { 1: 0.30, 2: 0.15, 3: 0.10, ... }; // organic CTR curve
```

Set `PSI_API_KEY` to enable real Lighthouse scores. Without it, scores fall back to a deterministic seeded algorithm so the same URL always yields the same numbers (handy for demos, not for accuracy).

## User flow

1. **Landing** — User enters a dealer URL.
2. **Validation** — `NON_DEALER_HOSTS` blocklist + `DEALER_KEYWORDS` / `BRAND_KEYWORDS` heuristic make sure it looks like a dealer site.
3. **City + make capture** — for trade-area framing.
4. **Scan animation** — fake-but-pleasant progress bar while we run real PSI calls + seeded GEO/AEO checks.
5. **Result** — band verdict + `$X / mo damage` headline, leaderboard, gap-by-gap competitor cards, "How we got to that number" math breakdown.
6. **Email gate** — captures email (and optionally hits the GHL webhook) before unlocking the full report + book-call CTA.

## Scoring system (SAGGY score, 0-60)

Three pillars, each scored 0-20:

| Pillar | Source |
|---|---|
| **SEO** | Lighthouse SEO category × 20 (or seeded fallback). |
| **AEO** | Average of Lighthouse Accessibility + Best Practices × 20. |
| **GEO** | A bag of on-page AI-citeability signals (`GEO_AUDITS` array): schema, FAQ, semantic markup, etc. |

`bandFor()` then maps the 0-60 total to a percent and looks it up in `BANDS` (Trade Area Champ → Solid Ground → Slipping → Bleeding → Off The Map).

## Cost calculation

```
1. Rank yourself vs competitors by composite SAGGY score.
2. lostShare   = CTR_BY_RANK[#1] - CTR_BY_RANK[yourRank]    (after a +2 organic offset)
3. lostClicks  = lostShare × DEFAULT_TRADE_AREA_VOLUME
4. lostLeads   = lostClicks × LEAD_CONVERSION_RATE
5. damage / mo = lostLeads × CPL_BENCHMARK
```

Numbers are explicitly directional and labeled as such on the result page. A "Heads up" disclaimer at the bottom of the math breakdown reminds the user that real numbers come from their CRM.

## Mascot asset pipeline

The mascot is delivered as VP9 alpha + animated WebP. To refresh from a new ProRes / MOV source:

```bash
# WebM with VP9 alpha — Chrome / Firefox / Edge
ffmpeg -i "your-new-clip.mov" \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 \
  -auto-alt-ref 0 -metadata:s:v:0 alpha_mode=1 -an \
  saggy_mascot.webm

# Animated WebP fallback for Safari
ffmpeg -i "your-new-clip.mov" \
  -vf "scale=540:960:flags=lanczos" \
  -vcodec libwebp_anim -lossless 0 -compression_level 6 -q:v 55 \
  -loop 0 -pix_fmt yuva420p -an \
  saggy_mascot.webp
```

Both files keep their alpha channel — no `mix-blend-mode` hacks needed, the mascot composites cleanly over any background.

If your source is an MP4 with a black background instead of true alpha, you'll need to chroma-key it first (corner flood-fill + edge despill) before encoding. See the project history / ask Claude to recreate that pipeline.

## Customizing for a different vertical

A3 Brands is automotive-first, but the framework is vertical-agnostic. To rebrand:

- **Constants** — change `CPL_BENCHMARK`, `LEAD_CONVERSION_RATE`, `DEFAULT_TRADE_AREA_VOLUME` to the new vertical's benchmarks.
- **Copy** — search for "dealer", "automotive", "rooftop", "honda" and rewrite for the new domain.
- **Validation** — `NON_DEALER_HOSTS` / `DEALER_KEYWORDS` / `BRAND_KEYWORDS` lists need to be replaced.
- **Mascot** — drop in new assets at the same filenames.
- **Verdicts** — copy in `BANDS` is automotive-flavored ("eating your trade area"). Rewrite per vertical.

## Browser support

- **Chrome / Firefox / Edge** — full experience, native VP9 alpha.
- **Safari** — falls back to the animated WebP `<img>` inside the `<video>` element.
- **Mobile** — responsive breakpoint at the `@media (max-width: 980px)` rule. Saggy panel collapses to a top stack on narrow viewports.

## Known limitations

- PSI API has a small free quota — heavy traffic without an API key will get rate-limited and silently fall back to seeded scores.
- The seeded GEO score is deterministic but not real — it's a placeholder until a real GBP / on-page AI audit endpoint is wired in.
- The "1,800 monthly searches" trade-area volume is a single constant. Per-make / per-DMA volume would meaningfully sharpen the damage number.
- No bot protection on PSI calls. A scraper can burn the quota in an afternoon.

## Roadmap

See the upgrade ideas already discussed: Calendly inline embed, CRM webhook + Slack alerts, retargeting pixels, real DataForSEO/SerpApi integration, AEO scoring via real LLM citation tests, embeddable "we're #X" badge, and so on. Top three for revenue lift: inline booking, instant CRM/Slack handoff, two-step lead form.
