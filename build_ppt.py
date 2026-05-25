"""Build the production-methodology deck for the two-interface results page.

v3 — updated 2026-05-19 after the Vercel deploy went live and the
duplicate-lead guard landed. Changes since v2:
  · Repo pushed to github.com/jhonrhyanaabunda-dot/a3brands_analyzer,
    auto-deployed via Vercel on every push to main.
  · tsconfig strict:true (was false) — discriminated unions now narrow.
  · POST /api/leads rejects duplicates by email or name (409 + field),
    UI surfaces "That <field> already exists — try another."
  · GHL webhook moved to fire only AFTER the leads save succeeds, so
    dup-retry no longer double-posts to the sales pipeline.
The persistence-on-Vercel warning is now active, not theoretical.
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# Theme colors (matched to the site)
BG = RGBColor(0x0A, 0x1A, 0x0F)          # near-black green
PANEL = RGBColor(0x10, 0x24, 0x16)       # slightly lighter panel
LIME = RGBColor(0x7C, 0xB3, 0x42)
CREAM = RGBColor(0xF5, 0xEF, 0xE0)
GRAY = RGBColor(0xB8, 0xB0, 0xA0)
DIM = RGBColor(0x70, 0x6A, 0x5E)
RED = RGBColor(0xE0, 0x5A, 0x42)
AMBER = RGBColor(0xE2, 0xA0, 0x5A)       # for PARTIAL status
ACCENT_FILL = RGBColor(0x12, 0x2C, 0x1B)
DONE_FILL = RGBColor(0x12, 0x2C, 0x1B)   # dark green panel for done items
TODO_FILL = RGBColor(0x2A, 0x12, 0x10)   # dark red panel for still-open items
WIP_FILL  = RGBColor(0x2A, 0x22, 0x10)   # dark amber for partial items

FONT_HEAD = "Helvetica Neue"
FONT_BODY = "Helvetica Neue"
FONT_MONO = "Menlo"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height

BLANK = prs.slide_layouts[6]


def add_bg(slide, color=BG):
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SW, SH)
    bg.line.fill.background()
    bg.fill.solid()
    bg.fill.fore_color.rgb = color
    bg.shadow.inherit = False
    return bg


def add_text(slide, left, top, width, height, text, *,
             font=FONT_BODY, size=18, color=CREAM, bold=False,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.margin_left = Inches(0.05)
    tf.margin_right = Inches(0.05)
    tf.margin_top = Inches(0.02)
    tf.margin_bottom = Inches(0.02)
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    return tb


def add_bullets(slide, left, top, width, height, items, *,
                size=16, color=CREAM, bullet_color=LIME, line_spacing=1.25):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.05)
    tf.margin_right = Inches(0.05)
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.line_spacing = line_spacing
        p.space_after = Pt(6)
        b = p.add_run()
        b.text = "→  "
        b.font.name = FONT_MONO
        b.font.size = Pt(size)
        b.font.color.rgb = bullet_color
        b.font.bold = True
        r = p.add_run()
        r.text = item
        r.font.name = FONT_BODY
        r.font.size = Pt(size)
        r.font.color.rgb = color
    return tb


def add_panel(slide, left, top, width, height, color=PANEL, border=LIME, border_w=0.75):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    sh.adjustments[0] = 0.06
    sh.fill.solid()
    sh.fill.fore_color.rgb = color
    sh.line.color.rgb = border
    sh.line.width = Pt(border_w)
    sh.shadow.inherit = False
    return sh


def add_eyebrow_title(slide, eyebrow, title, *, top=Inches(0.45)):
    add_text(slide, Inches(0.6), top, Inches(9), Inches(0.35),
             eyebrow.upper(), font=FONT_MONO, size=11, color=LIME, bold=True)
    add_text(slide, Inches(0.6), top + Inches(0.35), Inches(11), Inches(0.7),
             title, font=FONT_HEAD, size=30, color=CREAM, bold=True)
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,
                                  Inches(0.6), top + Inches(1.05),
                                  Inches(0.7), Emu(20000))
    line.line.fill.background()
    line.fill.solid()
    line.fill.fore_color.rgb = LIME


def add_status_badge(slide, kind):
    """Top-right pill badge: 'DONE', 'PARTIAL', 'STILL OPEN'."""
    palette = {
        "DONE":      (LIME,  DONE_FILL),
        "PARTIAL":   (AMBER, WIP_FILL),
        "STILL OPEN":(RED,   TODO_FILL),
    }
    if kind not in palette:
        return
    border, fill = palette[kind]
    w = Inches(1.7) if kind == "STILL OPEN" else Inches(1.3)
    x = SW - w - Inches(0.5)
    y = Inches(0.55)
    pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, Inches(0.36))
    pill.adjustments[0] = 0.5
    pill.fill.solid()
    pill.fill.fore_color.rgb = fill
    pill.line.color.rgb = border
    pill.line.width = Pt(1.2)
    pill.shadow.inherit = False
    add_text(slide, x, y, w, Inches(0.36),
             kind, font=FONT_MONO, size=10, color=border, bold=True,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def add_footer(slide, slide_num, total):
    add_text(slide, Inches(0.6), SH - Inches(0.45), Inches(8), Inches(0.3),
             "A3 BRANDS  ·  SAGGY OUTRANK AUDIT  ·  BUILD STATUS v2",
             font=FONT_MONO, size=9, color=DIM)
    add_text(slide, SW - Inches(1.6), SH - Inches(0.45), Inches(1), Inches(0.3),
             f"{slide_num:02d} / {total:02d}",
             font=FONT_MONO, size=9, color=DIM, align=PP_ALIGN.RIGHT)


# =====================================================================
#   SLIDES
# =====================================================================
def slide_title():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    stripe = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.25), SH)
    stripe.line.fill.background()
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = LIME
    add_text(s, Inches(0.9), Inches(1.4), Inches(11), Inches(0.4),
             "PRODUCTION METHODOLOGY  ·  BUILD STATUS v3",
             font=FONT_MONO, size=14, color=LIME, bold=True)
    add_text(s, Inches(0.9), Inches(1.9), Inches(11.5), Inches(1.5),
             "Shipping the Two-Interface Results Page",
             font=FONT_HEAD, size=48, color=CREAM, bold=True)
    add_text(s, Inches(0.9), Inches(3.3), Inches(11.5), Inches(1.6),
             "Original methodology (May 15) called for Phase 1 first.\n"
             "We built Phases 3 + 4 + part of 2 instead, and skipped Phase 1.\n"
             "v3: live on Vercel, strict TS green, duplicate leads now rejected.",
             font=FONT_BODY, size=19, color=GRAY)
    add_text(s, Inches(0.9), Inches(5.7), Inches(11), Inches(0.4),
             "Saggy Outrank Audit  ·  A3 Brands",
             font=FONT_MONO, size=12, color=LIME)
    add_text(s, Inches(0.9), Inches(6.05), Inches(11), Inches(0.4),
             "Updated 2026-05-19  ·  vercel auto-deploy  ·  strict typescript  ·  dedup by email + name",
             font=FONT_MONO, size=10, color=DIM)


def slide_status_board():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 02  ·  As of today", "What's live, what's halfway, what's still leaking.")

    def status_block(x, y, w, h, kind, items, border_color, fill_color):
        add_panel(s, x, y, w, h, color=fill_color, border=border_color, border_w=1.2)
        mark = {"DONE": "✓", "PARTIAL": "◐", "STILL OPEN": "✕"}[kind]
        add_text(s, x + Inches(0.3), y + Inches(0.15), Inches(0.5), Inches(0.5),
                 mark, font=FONT_HEAD, size=22, color=border_color, bold=True,
                 anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, x + Inches(0.85), y + Inches(0.18), Inches(3.5), Inches(0.4),
                 kind, font=FONT_MONO, size=12, color=border_color, bold=True)
        add_bullets(s, x + Inches(0.35), y + Inches(0.65), w - Inches(0.6), h - Inches(0.7),
                    items, size=12.5, color=CREAM, bullet_color=border_color, line_spacing=1.18)

    col_w = Inches(4.0)
    col_h = Inches(5.0)
    top_y = Inches(1.85)
    gap = Inches(0.15)
    x0 = Inches(0.6)

    status_block(x0, top_y, col_w, col_h, "DONE", [
        "Next.js App Router + TypeScript port (in-place).",
        "tsconfig strict:true — discriminated unions narrow correctly.",
        "Server-side audit at /api/audit.",
        "Firecrawl LLM scoring (v2/scrape · json extract).",
        "Local analyzer fallback (regex over fetched HTML).",
        "Seeded fallback for bot-blocked sites.",
        "24h disk cache at data/audit-cache.json.",
        "Lead persistence /api/leads (POST · GET · DELETE).",
        "Status workflow + PATCH /api/leads/[id].",
        "Sales console with redesigned lead-detail modal.",
        "Trade-area volume varies by city + make.",
        "Duplicate-lead guard: 409 + field on email or name match.",
        "GHL webhook fires only on save success — no dup double-posts.",
        "Vercel auto-deploy from main (a3brands_analyzer repo).",
    ], LIME, DONE_FILL)

    status_block(x0 + col_w + gap, top_y, col_w, col_h, "PARTIAL", [
        "Phase 2 persistence: NOW live on Vercel — JSON file store "
        "will not survive cold starts. Migration is urgent.",
        "Sales tooling: dashboard + status workflow shipped, "
        "but no auth gating yet.",
        "Audit cache is per-machine — multi-rep deploys "
        "will need a real KV / Supabase store.",
        "FIRECRAWL_API_KEY now set in Vercel; no rate limit "
        "or daily ceiling guards the endpoint.",
    ], AMBER, WIP_FILL)

    status_block(x0 + (col_w + gap) * 2, top_y, col_w, col_h, "STILL OPEN", [
        "Phase 1 leak: ?view=sales is unauthed.",
        "/api/leads has no auth — anyone can GET, PATCH, "
        "or DELETE every lead.",
        "Lead browser still receives full payload; no "
        "server-side trimming.",
        "No tokenized /r/<token> URLs for lead-facing reports.",
        "No audit log of who pulled which lead (report_views).",
        "Email delivery still uses placeholder GHL webhook.",
    ], RED, TODO_FILL)

    add_text(s, Inches(0.6), Inches(7.0), Inches(12.3), Inches(0.4),
             "v3: deploy is live — persistence + auth are now production gaps, not roadmap items.",
             font=FONT_BODY, size=13, color=GRAY)


def slide_flaw():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 03  ·  The starting point", "The flaw we have to fix first.")
    add_status_badge(s, "STILL OPEN")

    add_panel(s, Inches(0.6), Inches(2.0), Inches(6.0), Inches(4.6), border=RED)
    add_text(s, Inches(0.9), Inches(2.15), Inches(5.6), Inches(0.4),
             "TODAY — STILL UNFIXED", font=FONT_MONO, size=11, color=RED, bold=True)
    add_text(s, Inches(0.9), Inches(2.55), Inches(5.6), Inches(0.5),
             "?view=sales is a CSS toggle.", font=FONT_HEAD, size=22, color=CREAM, bold=True)
    add_bullets(s, Inches(0.9), Inches(3.2), Inches(5.6), Inches(3.2), [
        "Every lead still receives the full sales-only HTML.",
        "display:none is the only thing hiding gap math + fixes.",
        "DevTools → unhide → read the whole report.",
        "And /api/leads is also unauthed — same class of leak.",
    ], size=15, bullet_color=RED)

    add_panel(s, Inches(6.9), Inches(2.0), Inches(6.0), Inches(4.6))
    add_text(s, Inches(7.2), Inches(2.15), Inches(5.6), Inches(0.4),
             "PRODUCTION GOAL", font=FONT_MONO, size=11, color=LIME, bold=True)
    add_text(s, Inches(7.2), Inches(2.55), Inches(5.6), Inches(0.5),
             "Sales content never leaves the server.",
             font=FONT_HEAD, size=22, color=CREAM, bold=True)
    add_bullets(s, Inches(7.2), Inches(3.2), Inches(5.6), Inches(3.2), [
        "Lead browser receives only the trimmed payload.",
        "Sales view + sales APIs live behind authentication.",
        "Server decides what to render based on viewer role.",
        "CSS is a UX layer — not a permission boundary.",
    ], size=15)


def slide_threat_model():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 04  ·  Threat model", "What we're protecting, and from whom.")
    add_status_badge(s, "STILL OPEN")

    headers = ["Asset", "Risk", "Mitigation Tier"]
    rows = [
        ("Fix recommendations + gap math",
         "Lead self-serves and skips the strategy call",
         "HIGH  —  server-gated"),
        ("Cost-model logic (CTR × volume × CPL)",
         "Competitor scrapes our methodology",
         "MED   —  keep server-side"),
        ("Lead PII (name · email · phone)",
         "Any visitor GETs /api/leads in plaintext",
         "HIGH  —  auth required"),
        ("Sales rep identity / activity",
         "Lead identifies who pulled their report",
         "LOW   —  internal audit only"),
    ]
    top = Inches(1.95)
    col_w = [Inches(3.6), Inches(5.0), Inches(3.7)]
    col_x = [Inches(0.6), Inches(0.6) + col_w[0], Inches(0.6) + col_w[0] + col_w[1]]
    for i, h in enumerate(headers):
        add_text(s, col_x[i], top, col_w[i], Inches(0.4),
                 h.upper(), font=FONT_MONO, size=11, color=LIME, bold=True)
    for r_idx, row in enumerate(rows):
        y = top + Inches(0.55) + r_idx * Inches(1.0)
        bg = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,
                                Inches(0.6), y, Inches(12.3), Inches(0.85))
        bg.adjustments[0] = 0.08
        bg.fill.solid(); bg.fill.fore_color.rgb = PANEL
        bg.line.color.rgb = LIME; bg.line.width = Pt(0.5)
        bg.shadow.inherit = False
        for i, cell in enumerate(row):
            color = LIME if i == 2 else CREAM
            font = FONT_MONO if i == 2 else FONT_BODY
            size = 12 if i == 2 else 14
            add_text(s, col_x[i] + Inches(0.2), y + Inches(0.2), col_w[i] - Inches(0.3), Inches(0.55),
                     cell, size=size, color=color, font=font,
                     bold=(i == 2), anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(0.6), Inches(6.7), Inches(12.3), Inches(0.4),
             "Two HIGH-tier assets are currently public. Both fall to a Vercel Password Protect wrapper.",
             font=FONT_BODY, size=13, color=GRAY)


def slide_architecture():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 05  ·  Architecture", "What's actually wired (and the auth gap).")
    add_status_badge(s, "PARTIAL")

    def node(x, y, w, h, label, sub=None, border=LIME, fill=PANEL, label_color=CREAM):
        sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
        sh.adjustments[0] = 0.14
        sh.fill.solid(); sh.fill.fore_color.rgb = fill
        sh.line.color.rgb = border; sh.line.width = Pt(1.0)
        sh.shadow.inherit = False
        tb = s.shapes.add_textbox(x, y, w, h)
        tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = label; r.font.name = FONT_BODY
        r.font.size = Pt(12); r.font.bold = True; r.font.color.rgb = label_color
        if sub:
            p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.CENTER
            r2 = p2.add_run(); r2.text = sub; r2.font.name = FONT_MONO
            r2.font.size = Pt(9); r2.font.color.rgb = GRAY

    def arrow(x1, y1, x2, y2, label=None, color=LIME):
        line = s.shapes.add_connector(1, x1, y1, x2, y2)
        line.line.color.rgb = color
        line.line.width = Pt(1.1)
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            add_text(s, mx - Inches(0.9), my - Inches(0.16), Inches(1.8), Inches(0.28),
                     label, font=FONT_MONO, size=8.5, color=GRAY, align=PP_ALIGN.CENTER)

    # ---- Row 1: browser entries ----
    node(Inches(0.6), Inches(1.9), Inches(3.4), Inches(0.85),
         "Lead browser", "form · audit · result")
    node(Inches(9.3), Inches(1.9), Inches(3.4), Inches(0.85),
         "Sales console", "?view=sales · ⚠ unauthed", border=RED)

    # ---- Row 2: API routes ----
    node(Inches(0.6), Inches(3.2), Inches(3.4), Inches(0.85),
         "POST /api/audit", "Next.js route", border=LIME, fill=ACCENT_FILL)
    node(Inches(4.85), Inches(3.2), Inches(3.6), Inches(0.85),
         "POST /api/leads", "validate + persist", border=LIME, fill=ACCENT_FILL)
    node(Inches(9.3), Inches(3.2), Inches(3.4), Inches(0.85),
         "GET / PATCH / DELETE", "/api/leads · ⚠ unauthed", border=RED, fill=ACCENT_FILL)

    # ---- Row 3: audit pipeline (3 fallbacks) ----
    node(Inches(0.6), Inches(4.55), Inches(2.5), Inches(0.85),
         "Firecrawl", "v2/scrape · LLM extract", border=LIME)
    node(Inches(3.3), Inches(4.55), Inches(2.5), Inches(0.85),
         "Local analyzer", "regex over HTML", border=GRAY)
    node(Inches(6.0), Inches(4.55), Inches(2.4), Inches(0.85),
         "Seeded", "urlSeed fallback", border=GRAY)

    # ---- Row 4: storage ----
    node(Inches(0.6), Inches(5.9), Inches(3.8), Inches(0.85),
         "data/audit-cache.json", "24h TTL · per-machine")
    node(Inches(4.85), Inches(5.9), Inches(3.6), Inches(0.85),
         "data/leads.json", "Lead[] · per-machine")

    # ---- arrows ----
    # Lead browser → /api/audit
    arrow(Inches(2.3), Inches(2.75), Inches(2.3), Inches(3.2), "scan")
    # Lead browser → /api/leads
    arrow(Inches(2.3), Inches(2.75), Inches(6.65), Inches(3.2), "lead submit")
    # Sales console → /api/leads (GET/PATCH/DELETE)
    arrow(Inches(11.0), Inches(2.75), Inches(11.0), Inches(3.2), "read · mutate", color=RED)
    # /api/audit → Firecrawl
    arrow(Inches(1.5), Inches(4.05), Inches(1.85), Inches(4.55))
    # /api/audit → analyzer fallback
    arrow(Inches(2.3), Inches(4.05), Inches(4.55), Inches(4.55))
    # /api/audit → seeded fallback
    arrow(Inches(3.0), Inches(4.05), Inches(7.2), Inches(4.55))
    # Audit pipeline → audit cache
    arrow(Inches(2.5), Inches(5.4), Inches(2.5), Inches(5.9), "write")
    # /api/leads → leads.json
    arrow(Inches(6.65), Inches(4.05), Inches(6.65), Inches(5.9), "append")

    # Caption / call-out
    add_text(s, Inches(0.6), Inches(7.0), Inches(12.3), Inches(0.4),
             "Red boxes = unauthed and externally reachable. Same code, just needs Vercel Password Protect on the /api/leads + sales routes.",
             font=FONT_BODY, size=13, color=GRAY)


def slide_auth():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 06  ·  Sales auth", "Three options, ordered by effort.")
    add_status_badge(s, "STILL OPEN")

    options = [
        ("01", "Vercel Password Protect / Cloudflare Access",
         "Wraps /sales/* and /api/leads/*. SSO with Google Workspace.",
         "~30 minutes",
         "RECOMMENDED — DO THIS FIRST"),
        ("02", "Magic-link email auth",
         "@a3brands.com email → 15-minute signed link.",
         "~half a day",
         "Phase 2 upgrade"),
        ("03", "Session auth with roles",
         "Clerk / Auth0 + RBAC.",
         "~1 week",
         "Defer until >5 reps"),
    ]
    y0 = Inches(2.0)
    for i, (num, title, body, effort, tag) in enumerate(options):
        y = y0 + i * Inches(1.5)
        add_panel(s, Inches(0.6), y, Inches(12.3), Inches(1.3),
                  border=LIME if i == 0 else DIM, border_w=1.5 if i == 0 else 0.5)
        add_text(s, Inches(0.9), y + Inches(0.2), Inches(0.8), Inches(0.9),
                 num, font=FONT_MONO, size=28, color=LIME, bold=True,
                 anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(1.9), y + Inches(0.18), Inches(7.5), Inches(0.45),
                 title, font=FONT_HEAD, size=17, color=CREAM, bold=True)
        add_text(s, Inches(1.9), y + Inches(0.65), Inches(7.5), Inches(0.5),
                 body, size=13, color=GRAY)
        add_text(s, Inches(9.5), y + Inches(0.22), Inches(3.2), Inches(0.4),
                 effort, font=FONT_MONO, size=12, color=LIME, bold=True, align=PP_ALIGN.RIGHT)
        add_text(s, Inches(9.5), y + Inches(0.65), Inches(3.2), Inches(0.4),
                 tag, font=FONT_MONO, size=10, color=DIM if i != 0 else LIME, align=PP_ALIGN.RIGHT)

    add_text(s, Inches(0.6), Inches(6.7), Inches(12.3), Inches(0.4),
             "None of the three is built yet. The sales-only HTML and PII at /api/leads remain publicly reachable.",
             font=FONT_BODY, size=13, color=GRAY)


def slide_urls():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 07  ·  URL strategy", "Tokenize the lead link. Always.")
    add_status_badge(s, "STILL OPEN")

    add_panel(s, Inches(0.6), Inches(2.0), Inches(6.0), Inches(4.4), border=RED)
    add_text(s, Inches(0.9), Inches(2.15), Inches(5.6), Inches(0.4),
             "TODAY — NO TOKENS", font=FONT_MONO, size=11, color=RED, bold=True)
    add_text(s, Inches(0.9), Inches(2.6), Inches(5.6), Inches(0.6),
             "/?view=sales", font=FONT_MONO, size=22, color=CREAM, bold=True)
    add_bullets(s, Inches(0.9), Inches(3.3), Inches(5.6), Inches(2.8), [
        "Query-param toggle, anyone can flip it.",
        "Lead reports have no shareable URL at all.",
        "No expiry, no revoke, no per-lead access.",
    ], size=14, bullet_color=RED)

    add_panel(s, Inches(6.9), Inches(2.0), Inches(6.0), Inches(4.4))
    add_text(s, Inches(7.2), Inches(2.15), Inches(5.6), Inches(0.4),
             "GOAL", font=FONT_MONO, size=11, color=LIME, bold=True)
    add_text(s, Inches(7.2), Inches(2.6), Inches(5.6), Inches(0.6),
             "/r/k8x2q9vN_aPzL3RfH", font=FONT_MONO, size=20, color=CREAM, bold=True)
    add_bullets(s, Inches(7.2), Inches(3.3), Inches(5.6), Inches(2.8), [
        "128-bit opaque token — unguessable.",
        "Server maps token → lead internally.",
        "Tokens expire after 30 days, redirect to 'book a call'.",
        "Sales reads via /sales/<id> behind auth — internal id fine.",
    ], size=14)

    add_text(s, Inches(0.6), Inches(6.6), Inches(12.3), Inches(0.4),
             "Builds on storage.ts already in the repo — Lead.id is a UUID, just need a separate lead_token column.",
             font=FONT_BODY, size=13, color=GRAY)


def slide_data_model():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 08  ·  Data model", "What's persisted today (and what's missing).")
    add_status_badge(s, "PARTIAL")

    # Left panel: actual Lead type from storage.ts
    add_panel(s, Inches(0.6), Inches(1.95), Inches(8.0), Inches(2.4), border=LIME)
    add_text(s, Inches(0.85), Inches(2.05), Inches(7.5), Inches(0.4),
             "BUILT — data/leads.json  (type Lead in storage.ts)",
             font=FONT_MONO, size=11, color=LIME, bold=True)
    lead_schema = (
        "{\n"
        "  id, ts, status: 'pending' | 'confirmed' | 'cancelled',\n"
        "  name, dealership, email, phone,\n"
        "  url, city, make,\n"
        "  estimatedRank, monthlyDamage, monthlyLostLeads, monthlyLostClicks,\n"
        "  yourScores, competitorScores\n"
        "}"
    )
    tb = s.shapes.add_textbox(Inches(0.85), Inches(2.45), Inches(7.6), Inches(1.85))
    tf = tb.text_frame; tf.word_wrap = True
    for i, line in enumerate(lead_schema.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.line_spacing = 1.05
        r = p.add_run(); r.text = line
        r.font.name = FONT_MONO; r.font.size = Pt(12); r.font.color.rgb = CREAM

    # Mid panel: audit cache
    add_panel(s, Inches(0.6), Inches(4.5), Inches(8.0), Inches(2.4), border=LIME)
    add_text(s, Inches(0.85), Inches(4.6), Inches(7.5), Inches(0.4),
             "BUILT — data/audit-cache.json  (24h TTL keyed by url)",
             font=FONT_MONO, size=11, color=LIME, bold=True)
    cache_schema = (
        "{\n"
        "  \"https://bmwofsouthatlanta.com/\": {\n"
        "    ts: 1779165432110,\n"
        "    data: {\n"
        "      seo, aeo, geo, total, source: 'firecrawl' | 'analyzer' | 'seeded',\n"
        "      reasoning: { seo, aeo, geo }  // when firecrawl\n"
        "    }\n"
        "  }, ...\n"
        "}"
    )
    tb2 = s.shapes.add_textbox(Inches(0.85), Inches(5.0), Inches(7.6), Inches(1.85))
    tf2 = tb2.text_frame; tf2.word_wrap = True
    for i, line in enumerate(cache_schema.split("\n")):
        p = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
        p.line_spacing = 1.05
        r = p.add_run(); r.text = line
        r.font.name = FONT_MONO; r.font.size = Pt(11.5); r.font.color.rgb = CREAM

    # Right panel: what's missing
    add_panel(s, Inches(8.9), Inches(1.95), Inches(4.0), Inches(4.95), border=AMBER)
    add_text(s, Inches(9.1), Inches(2.05), Inches(3.7), Inches(0.4),
             "STILL TO ADD", font=FONT_MONO, size=11, color=AMBER, bold=True)
    add_bullets(s, Inches(9.1), Inches(2.5), Inches(3.7), Inches(4.3), [
        "Dedup: findDuplicateLead() blocks same email or name "
        "(case-insensitive). 409 + field surfaced to UI.",
        "lead_token (text unique) — for /r/<token>.",
        "report_views table — who pulled what.",
        "ghl_synced_at — retry CRM pushes without dupes.",
        "Move both files to Supabase / Vercel Postgres for any deploy.",
    ], size=12)

    add_text(s, Inches(0.6), Inches(7.0), Inches(12.3), Inches(0.4),
             "JSON files work in dev; Vercel serverless filesystem is read-only — first deploy will break persistence.",
             font=FONT_BODY, size=12, color=GRAY)


def slide_trimming():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 09  ·  Payload trimming", "Still serving the full thing to both views.")
    add_status_badge(s, "STILL OPEN")

    add_panel(s, Inches(0.6), Inches(1.95), Inches(6.0), Inches(5.0), border=RED)
    add_text(s, Inches(0.9), Inches(2.1), Inches(5.5), Inches(0.4),
             "TODAY — GET /api/leads (unauthed)", font=FONT_MONO, size=12, color=RED, bold=True)
    add_text(s, Inches(0.9), Inches(2.5), Inches(5.5), Inches(0.4),
             "Lead + sales receive the same JSON.", font=FONT_BODY, size=12, color=GRAY)
    same_json = (
        "{ leads: [ {\n"
        "  id, ts, status,\n"
        "  name, dealership, email, phone,    // PII\n"
        "  url, city, make,\n"
        "  estimatedRank, monthlyDamage, ...   // audit\n"
        "  yourScores, competitorScores       // gap analysis\n"
        "} ] }"
    )
    tb = s.shapes.add_textbox(Inches(0.9), Inches(3.1), Inches(5.5), Inches(3.5))
    tf = tb.text_frame; tf.word_wrap = True
    for i, line in enumerate(same_json.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        r = p.add_run(); r.text = line
        r.font.name = FONT_MONO; r.font.size = Pt(13); r.font.color.rgb = CREAM
    add_text(s, Inches(0.9), Inches(6.3), Inches(5.5), Inches(0.4),
             "Same shape leaks PII + methodology to lead browser.",
             font=FONT_MONO, size=11, color=RED)

    add_panel(s, Inches(6.9), Inches(1.95), Inches(6.0), Inches(5.0), border=LIME, border_w=1.5)
    add_text(s, Inches(7.2), Inches(2.1), Inches(5.5), Inches(0.4),
             "GOAL — split into two endpoints", font=FONT_MONO, size=12, color=LIME, bold=True)
    add_text(s, Inches(7.2), Inches(2.5), Inches(5.5), Inches(0.4),
             "Sales JSON keeps all fields. Lead JSON keeps the report only.",
             font=FONT_BODY, size=12, color=GRAY)
    split_json = (
        "GET /api/report/:token     (lead — public, narrow)\n"
        "  → { band, damage, verdict, leaderboard, city }\n"
        "\n"
        "GET /api/leads/:id         (sales — auth required)\n"
        "  → full Lead record (current shape)\n"
    )
    tb2 = s.shapes.add_textbox(Inches(7.2), Inches(3.1), Inches(5.5), Inches(3.5))
    tf2 = tb2.text_frame; tf2.word_wrap = True
    for i, line in enumerate(split_json.split("\n")):
        p = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
        r = p.add_run(); r.text = line
        r.font.name = FONT_MONO; r.font.size = Pt(12); r.font.color.rgb = CREAM
    add_text(s, Inches(7.2), Inches(6.3), Inches(5.5), Inches(0.4),
             "Trim on the server — not in the browser.",
             font=FONT_MONO, size=11, color=LIME)


def slide_audit_logic():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 10  ·  Where the audit runs", "Done — moved server-side with a 3-tier fallback.")
    add_status_badge(s, "DONE")

    add_bullets(s, Inches(0.6), Inches(2.0), Inches(12.3), Inches(4.0), [
        "All scoring now lives at /api/audit (server-side). The browser only owns form + theatre + render.",
        "Primary path: Firecrawl /v2/scrape with the json extract format — LLM rates SEO / AEO / GEO directly.",
        "Fallback 1: local analyzer at app/lib/analyzer.ts — server-fetches HTML and scores 23 regex signals.",
        "Fallback 2: seeded urlSeed scores — deterministic per URL, used when the site blocks bots entirely.",
        "Cached at data/audit-cache.json keyed by URL with 24h TTL — same site = same score within the window.",
        "CPL benchmark, CTR curve, trade-area volume now derived per (city, make) — no constants in browser JS.",
    ], size=14.5, line_spacing=1.4)

    add_text(s, Inches(0.6), Inches(6.5), Inches(12.3), Inches(0.5),
             "Files: app/api/audit/route.ts · app/lib/firecrawl.ts · app/lib/analyzer.ts · app/lib/audit.ts (browser).",
             font=FONT_MONO, size=12, color=GRAY)


def slide_rollout():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 11  ·  Rollout phases", "Plan vs. reality.")

    # Each phase: tag, title, status, body
    phases = [
        ("PHASE 1", "Stop the leak",  "STILL OPEN",
         "Conditional render of sales blocks. Vercel Password Protect on /sales/* + /api/leads/*. NOT YET BUILT."),
        ("PHASE 2", "Persist + tokenize", "PARTIAL",
         "/api/leads (POST · GET · PATCH · DELETE) shipped against data/leads.json. Tokenized /r/<token> URLs not yet built. Storage still local-only."),
        ("PHASE 3", "Server-side audit",  "DONE",
         "Audit moved to /api/audit with Firecrawl LLM scoring, local analyzer fallback, seeded fallback, and 24h disk cache."),
        ("PHASE 4", "Sales tooling",      "PARTIAL",
         "Console dashboard, redesigned lead-detail modal, status workflow (pending · confirmed · cancelled), kebab dropdown shipped. CRM deep-links + activity audit still open."),
    ]
    border_for = {"DONE": LIME, "PARTIAL": AMBER, "STILL OPEN": RED}
    fill_for   = {"DONE": DONE_FILL, "PARTIAL": WIP_FILL, "STILL OPEN": TODO_FILL}

    y0 = Inches(1.85)
    for i, (tag, title, status, body) in enumerate(phases):
        y = y0 + i * Inches(1.2)
        border = border_for[status]; fill = fill_for[status]
        add_panel(s, Inches(0.6), y, Inches(12.3), Inches(1.05),
                  color=fill, border=border, border_w=1.2)
        add_text(s, Inches(0.9), y + Inches(0.18), Inches(1.6), Inches(0.4),
                 tag, font=FONT_MONO, size=12, color=border, bold=True)
        add_text(s, Inches(0.9), y + Inches(0.52), Inches(1.6), Inches(0.4),
                 status, font=FONT_MONO, size=10, color=border, bold=True)
        add_text(s, Inches(2.7), y + Inches(0.15), Inches(3.5), Inches(0.45),
                 title, font=FONT_HEAD, size=17, color=CREAM, bold=True)
        add_text(s, Inches(2.7), y + Inches(0.55), Inches(10.0), Inches(0.55),
                 body, size=12.5, color=GRAY)

    add_text(s, Inches(0.6), Inches(6.85), Inches(12.3), Inches(0.4),
             "We went 3 → 4 → ½ of 2 → still need 1. That's fine — but Phase 1 must close before any deploy.",
             font=FONT_BODY, size=13, color=GRAY)


def slide_decisions():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 12  ·  Decisions — resolved vs. open", "Where each call landed since v1.")

    # Each row: question, answer, resolved-or-not
    items = [
        ("Hosting", "Vercel (Next.js scaffold + .vercelignore in repo).", True),
        ("Audit scoring engine", "Firecrawl /v2/scrape · json extract (LLM-rated).", True),
        ("Local persistence", "JSON files in data/ — dev only. Supabase before deploy.", True),
        ("Sales auth source", "Still open — Google Workspace likely candidate.", False),
        ("Lead-link sharing", "Still open — forwardable vs one-time-use.", False),
        ("Email delivery", "Still open — GHL webhook placeholder is firing; no transactional sender.", False),
    ]
    y0 = Inches(1.9)
    for i, (q, a, resolved) in enumerate(items):
        y = y0 + i * Inches(0.78)
        color = LIME if resolved else AMBER
        glyph = "✓" if resolved else "◐"
        circle = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.6), y, Inches(0.5), Inches(0.5))
        circle.fill.solid(); circle.fill.fore_color.rgb = ACCENT_FILL
        circle.line.color.rgb = color; circle.line.width = Pt(1.0)
        circle.shadow.inherit = False
        add_text(s, Inches(0.6), y, Inches(0.5), Inches(0.5),
                 glyph, font=FONT_HEAD, size=16, color=color, bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(1.35), y + Inches(0.02), Inches(3.5), Inches(0.4),
                 q, font=FONT_HEAD, size=15, color=CREAM, bold=True)
        add_text(s, Inches(4.95), y + Inches(0.05), Inches(7.9), Inches(0.5),
                 a, size=13, color=GRAY)

    add_text(s, Inches(0.6), Inches(6.9), Inches(12.3), Inches(0.4),
             "Three resolved, three open. None of the open ones blocks Phase 1.",
             font=FONT_BODY, size=12.5, color=GRAY)


def slide_not_to_build():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    add_eyebrow_title(s, "Slide 13  ·  Scope discipline", "Still NOT building.")
    not_items = [
        ("Full RBAC system",
         "Two roles — lead, sales. Hardcode it."),
        ("Admin UI for editing leads",
         "GHL / the CRM owns follow-up content."),
        ("Real-time updates / websockets",
         "Reports are point-in-time snapshots."),
        ("Multi-tenant infrastructure",
         "One agency, one workspace. Don't pretend to be a SaaS yet."),
    ]
    y0 = Inches(2.0)
    for i, (title, body) in enumerate(not_items):
        y = y0 + i * Inches(1.05)
        add_panel(s, Inches(0.6), y, Inches(12.3), Inches(0.9), border=RED, border_w=0.6)
        add_text(s, Inches(0.9), y + Inches(0.18), Inches(0.5), Inches(0.6),
                 "✕", font=FONT_HEAD, size=24, color=RED, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(1.6), y + Inches(0.12), Inches(4.5), Inches(0.5),
                 title, font=FONT_HEAD, size=16, color=CREAM, bold=True)
        add_text(s, Inches(6.0), y + Inches(0.18), Inches(7.0), Inches(0.6),
                 body, size=14, color=GRAY, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(0.6), Inches(6.7), Inches(12.3), Inches(0.4),
             "Every 'no' here buys engineering time for Phase 1.",
             font=FONT_BODY, size=13, color=GRAY)


def slide_next_step():
    s = prs.slides.add_slide(BLANK)
    add_bg(s)
    stripe = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.25), SH)
    stripe.line.fill.background()
    stripe.fill.solid(); stripe.fill.fore_color.rgb = LIME
    add_text(s, Inches(0.9), Inches(1.2), Inches(11), Inches(0.4),
             "NEXT STEP", font=FONT_MONO, size=14, color=LIME, bold=True)
    add_text(s, Inches(0.9), Inches(1.65), Inches(11.5), Inches(1.5),
             "Backfill Phase 1 before any deploy.", font=FONT_HEAD, size=42, color=CREAM, bold=True)
    add_bullets(s, Inches(0.9), Inches(3.15), Inches(11.5), Inches(2.8), [
        "Wrap /sales/* and /api/leads/* behind Vercel Password Protect (Google SSO).",
        "Split GET /api/leads into a lead-narrow + sales-full endpoint pair.",
        "Stop rendering sales-only HTML in the lead browser — server-side conditional.",
        "Then ship Phase 2 properly: Supabase replaces the JSON files.",
    ], size=16, color=GRAY, bullet_color=LIME, line_spacing=1.3)
    add_text(s, Inches(0.9), Inches(5.85), Inches(11.5), Inches(0.4),
             "Everything above can land in one short PR + an env-var change. No new packages required.",
             font=FONT_BODY, size=13, color=DIM)

    add_panel(s, Inches(0.9), Inches(6.4), Inches(6.0), Inches(0.7), border=LIME, border_w=1.5)
    add_text(s, Inches(0.9), Inches(6.4), Inches(6.0), Inches(0.7),
             "Approve Phase 1  →  ship before any external link",
             font=FONT_HEAD, size=16, color=LIME, bold=True,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


# Build deck
slide_title()
slide_status_board()
slide_flaw()
slide_threat_model()
slide_architecture()
slide_auth()
slide_urls()
slide_data_model()
slide_trimming()
slide_audit_logic()
slide_rollout()
slide_decisions()
slide_not_to_build()
slide_next_step()

total = len(prs.slides)
for idx, slide in enumerate(prs.slides, start=1):
    if idx == 1 or idx == total:
        continue
    add_footer(slide, idx, total)

out_path = "/Users/rhea/Desktop/saggy 2/Saggy_Two_Interface_Methodology.pptx"
prs.save(out_path)
print(f"Saved: {out_path}  ({total} slides)")
