"use client";

import { useEffect } from "react";
import { initAudit } from "./lib/audit";

export default function Page() {
  useEffect(() => {
    initAudit();
  }, []);

  return (
    <>
      <header className="topbar">
        <a className="logo" href="/" aria-label="A3 Brands">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/a3brands-logo.png" alt="A3 Brands · Automotive SEO Experts" />
        </a>
        <div className="step-indicator" id="stepIndicator"></div>
      </header>

      {/* ============ SALES DASHBOARD (entry surface for ?view=sales) ============ */}
      <section className="screen" id="screen-sales-dash">
        <div className="sales-dash-wrap">
          <div className="sales-dash-header">
            <div>
              <div className="eyebrow">Sales Console</div>
              <h1 className="sales-dash-title">User Activity</h1>
              <p className="sales-dash-sub">
                Every dealership that&apos;s run an audit on this device. Click any row to pull up the full report.
              </p>
            </div>
            <div className="sales-dash-actions">
              <div className="sales-search">
                <svg className="sales-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  id="salesSearchInput"
                  className="sales-search-input"
                  placeholder="Search leads…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" className="sales-search-clear" id="salesSearchClear" aria-label="Clear search" hidden>✕</button>
              </div>
              <button type="button" className="sales-dash-btn" id="salesNewAuditBtn">+ New Audit</button>
              <button type="button" className="sales-dash-btn ghost" id="salesDashClearBtn">Clear Log</button>
            </div>
          </div>

          <div className="submissions-table-wrap">
            <table className="submissions-table">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>#</th>
                  <th>Lead</th>
                  <th>Contact</th>
                  <th>Audit</th>
                  <th style={{ width: 110 }}>Damage</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 140 }}>Submitted</th>
                  <th style={{ width: 56, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody id="submissionsDashBody"></tbody>
            </table>
          </div>

          <nav className="submissions-pagination" id="submissionsDashPagination" aria-label="Lead pagination" hidden>
            <div className="submissions-pagination-info" id="submissionsDashPagInfo">—</div>
            <div className="submissions-pagination-nav">
              <button type="button" className="submissions-pagination-btn" id="submissionsDashPagPrev" aria-label="Previous page">‹ Prev</button>
              <span className="submissions-pagination-page" id="submissionsDashPagPage">1 / 1</span>
              <button type="button" className="submissions-pagination-btn" id="submissionsDashPagNext" aria-label="Next page">Next ›</button>
            </div>
          </nav>

          <div className="submissions-note" style={{ marginTop: 18 }}>
            Backed by <b>/api/leads</b> (data/leads.json on the server). Every completed audit form lands here for any sales rep to pick up.
          </div>
        </div>
      </section>

      {/* ============ SCREEN 1: LANDING ============ */}
      <section className="screen active" id="screen-landing">
        <div className="landing-wrap">
          <div className="eyebrow">GALAXY · Outrank Audit</div>
          <h1 className="hero-headline">
            Who&apos;s <span className="accent">outranking</span> you?
          </h1>
          <p className="hero-sub">
            Drop your dealership URL. Saggy finds the rooftops eating your lunch in your trade area, and tells you exactly what it&apos;s costing you every month. 90 seconds. No fluff.
          </p>
          <div className="form-stack">
            <div className="field">
              <span className="field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
                </svg>
              </span>
              <input type="url" id="urlInput" placeholder="https://yourdealership.com" autoComplete="url" />
            </div>
            <button id="startBtn" className="full-cta">Find Who&apos;s Outranking Me →</button>
          </div>
          <div className="url-error" id="urlError"></div>
          <div className="landing-meta">
            <div className="meta-item">
              <div className="label">What We Scan</div>
              <div className="val">SEO · AEO · GEO</div>
            </div>
            <div className="meta-item">
              <div className="label">Rooftops Compared</div>
              <div className="val">Top <span className="num">3</span> in trade area</div>
            </div>
            <div className="meta-item">
              <div className="label">Time</div>
              <div className="val">Under <span className="num">90</span> seconds</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SCREEN 2: INTERACTIVE INTRO + LIVE SCAN ============ */}
      {/* The six scan steps still run, but they advance on the dealer's taps
          (goal → city → rival) while the real audit runs in the background —
          no fixed-timer spinner. Left = scan progress, right = Saggy + intro. */}
      <section className="screen" id="screen-scan">
        <div className="scan-wrap">
          {/* LEFT: live scan progress */}
          <div className="scan-stage-card">
            <div className="scan-eyebrow"><span className="live-dot"></span>Live audit in progress</div>
            <h2 className="scan-title">Saggy&apos;s on the hunt.</h2>
            <ul className="scan-steps" id="scanSteps">
              <li className="scan-step" data-step="0">
                <div className="step-marker">1</div>
                <div className="step-label">Reading your site</div>
                <div className="step-detail">—</div>
              </li>
              <li className="scan-step" data-step="1">
                <div className="step-marker">2</div>
                <div className="step-label">Mapping the trade area</div>
                <div className="step-detail">—</div>
              </li>
              <li className="scan-step" data-step="2">
                <div className="step-marker">3</div>
                <div className="step-label">Finding competing rooftops</div>
                <div className="step-detail">—</div>
              </li>
              <li className="scan-step" data-step="3">
                <div className="step-marker">4</div>
                <div className="step-label">Scoring your SEO · AEO · GEO</div>
                <div className="step-detail">—</div>
              </li>
              <li className="scan-step" data-step="4">
                <div className="step-marker">5</div>
                <div className="step-label">Scoring the rooftops ahead of you</div>
                <div className="step-detail">—</div>
              </li>
              <li className="scan-step" data-step="5">
                <div className="step-marker">6</div>
                <div className="step-label">Calculating the leak</div>
                <div className="step-detail">—</div>
              </li>
            </ul>

            {/* f) Background scan indicator — climbs as real work lands */}
            <div className="scan-progress">
              <div className="scan-progress-track">
                <div className="scan-progress-fill" id="scanBarFill"></div>
              </div>
              <div className="scan-progress-meta">
                <span id="scanPercent">0%</span>
                <span className="scan-progress-note">Saggy&apos;s still scanning underneath this</span>
              </div>
              <button type="button" className="scan-skip" id="scanSkip">skip — take me straight to the audit</button>
            </div>
          </div>

          {/* RIGHT: Saggy + interaction */}
          <aside className="intro-panel">
            {/* a) Brand intro header — niche focus is the trust signal */}
            <div className="intro-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="intro-brand-logo" src="/a3brands-logo.png" alt="A3 Brands" />
              <div className="intro-brand-text">
                <div className="intro-brand-name">Automotive SEO experts</div>
                <div className="intro-brand-tag">Dealerships are all we do.</div>
              </div>
              <div className="intro-while">While Saggy scans…</div>
            </div>

            {/* b) Saggy + speech bubble */}
            <div className="intro-saggy">
              <div className="speech-bubble" id="speechBubble">Give me a second — I&apos;m pulling up your trade area. While I dig, help me aim this thing.</div>
              <div className="saggy-figure">
                <video
                  className="saggy-img"
                  id="saggyImg"
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-label="Saggy, A3 Brands mascot"
                >
                  <source src="/saggy_mascot.webm" type="video/webm" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/saggy_mascot.webp" alt="Saggy, A3 Brands mascot" />
                </video>
              </div>
              <div className="intro-saggy-foot">
                <div className="saggy-name">Saggy · on patrol</div>
                <button
                  type="button"
                  className="audio-toggle"
                  id="audioToggle"
                  aria-pressed="false"
                  aria-label="Toggle Saggy voice-over"
                >
                  <span className="audio-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path
                        className="audio-waves"
                        d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="audio-label">Saggy speaks</span>
                </button>
              </div>
            </div>

            {/* b) Pick your #1 goal — single-select, advances a scan step */}
            <div className="intro-block" id="goalBlock">
              <div className="intro-q">Pick your #1 goal</div>
              <div className="goal-cards" id="goalCards">
                <button type="button" className="goal-card" data-goal="being the first name shoppers find">
                  Be the first name shoppers find — search, AI answers, the map.
                </button>
                <button type="button" className="goal-card" data-goal="turning visibility into showroom traffic and phone-ups">
                  Turn visibility into real showroom traffic and phone-ups.
                </button>
                <button type="button" className="goal-card" data-goal="winning the click without the biggest ad budget">
                  Win the click without the biggest ad budget in town.
                </button>
              </div>
              <div className="intro-confirm" id="goalConfirm" hidden></div>
            </div>

            {/* c) Saggy's two quick questions — chips, one at a time */}
            <div className="intro-block" id="chipBlock" hidden>
              <div className="intro-q" id="chipQuestion"></div>
              <div className="chip-row" id="chipRow"></div>
            </div>

            {/* d) Tappable quick tour — what happens next, never how it's fixed */}
            <div className="intro-tour">
              <div className="intro-q intro-q-quiet">How this works</div>
              <div className="tour-steps" id="tourSteps">
                <button type="button" className="tour-step active" data-detail="You&apos;re here. Saggy benchmarks you against the rooftops winning your trade area — no cost, no commitment.">
                  <span className="tour-step-num">1</span>
                  <span className="tour-step-label">Free audit<small>you&apos;re here</small></span>
                  <span className="tour-chev" aria-hidden="true">›</span>
                </button>
                <button type="button" className="tour-step" data-detail="We walk you through where you&apos;re losing ground and what we&apos;d prioritize first. Still free, no obligation.">
                  <span className="tour-step-num">2</span>
                  <span className="tour-step-label">Strategy call<small>your fixes, free</small></span>
                  <span className="tour-chev" aria-hidden="true">›</span>
                </button>
                <button type="button" className="tour-step" data-detail="If it&apos;s a fit, our automotive-only team does the heavy lifting across SEO, AEO and GEO. You stay focused on selling cars.">
                  <span className="tour-step-num">3</span>
                  <span className="tour-step-label">We execute<small>we do the work</small></span>
                  <span className="tour-chev" aria-hidden="true">›</span>
                </button>
                <button type="button" className="tour-step" data-detail="You start showing up where shoppers actually look — and the rooftops that were ahead of you aren&apos;t anymore.">
                  <span className="tour-step-num">4</span>
                  <span className="tour-step-label">You climb<small>past the rivals</small></span>
                  <span className="tour-chev" aria-hidden="true">›</span>
                </button>
              </div>
              <div className="tour-detail" id="tourDetail">You&apos;re here. Saggy benchmarks you against the rooftops winning your trade area — no cost, no commitment.</div>
            </div>

            {/* e) Proof stats — PLACEHOLDER NUMBERS: A3 to swap in real figures.
                A real dealer logo / one-line testimonial here would outperform
                these stats — the testimonial slot below is left ready for it. */}
            <div className="intro-proof">
              <div className="proof-stat">
                <div className="proof-stat-num">200+</div>
                <div className="proof-stat-label">rooftops audited</div>
              </div>
              <div className="proof-stat">
                <div className="proof-stat-num">100%</div>
                <div className="proof-stat-label">automotive only</div>
              </div>
              <div className="proof-stat">
                <div className="proof-stat-num">SEO·AEO·GEO</div>
                <div className="proof-stat-label">full coverage</div>
              </div>
              {/* TESTIMONIAL SLOT — drop a real dealer logo + one-line quote here. */}
            </div>
          </aside>
        </div>
      </section>

      {/* ============ SCREEN 3: LEAD CAPTURE ============ */}
      <section className="screen" id="screen-leadcap">
        <div className="lead-wrap">
          <div className="lead-eyebrow">
            <div className="eyebrow">Audit Complete · Report Ready</div>
          </div>
          <h2 className="lead-headline">
            Saggy found <span className="accent" id="leadCompCount">3</span> rooftops ahead of you.
          </h2>
          <p className="lead-sub">
            Tell us where to send the breakdown. We&apos;ll email the leaderboard, the gap analysis, and the action plan to flip it.
          </p>
          <div className="lead-preview" id="leadPreview" hidden>
            <div className="lead-preview-label">Estimated Monthly Damage</div>
            <div className="lead-preview-stat" id="leadPreviewStat">$—</div>
            <div className="lead-preview-sub">Lost leads × $80 CPL · Full math inside</div>
          </div>
          <form className="lead-form" id="leadForm" autoComplete="on" noValidate>
            <div className="hp-field" aria-hidden="true">
              <label htmlFor="leadHoneypot">Company Website (leave blank)</label>
              <input type="text" id="leadHoneypot" name="company_website" tabIndex={-1} autoComplete="off" />
            </div>
            <div>
              <div className="field-label">Your Name</div>
              <input type="text" id="leadName" placeholder="Jane Smith" autoComplete="name" />
            </div>
            <div>
              <div className="field-label">Dealership</div>
              <input type="text" id="leadDealer" placeholder="Smith Auto Group" autoComplete="organization" />
            </div>
            <div className="lead-row">
              <div>
                <div className="field-label">Email</div>
                <input type="email" id="leadEmail" placeholder="jane@dealership.com" autoComplete="email" />
              </div>
              <div>
                <div className="field-label">Phone</div>
                <input type="tel" id="leadPhone" placeholder="(555) 555-5555" autoComplete="tel" />
              </div>
            </div>
            <div className="url-error" id="leadError" style={{ marginTop: 0 }}></div>
            <button type="submit" className="full-cta" id="leadSubmitBtn">Reveal The Leaderboard →</button>
            <div className="lead-fineprint">We&apos;ll never share your info. One follow-up email, then you&apos;re in control.</div>
          </form>
        </div>
      </section>

      {/* ============ SCREEN 4: RESULT ============ */}
      <section className="screen" id="screen-result">
        <div className="result-wrap">
          <div className="band-header">
            <div className="band-name" id="bandName">— —</div>
          </div>

          {/* THE DAMAGE */}
          <div className="damage-hero">
            <div className="saggy-mini-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="saggy-mini-img" src="/head-saggy.png" alt="Saggy" />
            </div>
            <div className="damage-label">Estimated Monthly Damage</div>
            <div className="damage-amount">
              <span className="currency">$</span>
              <span id="damageVal">0</span>
              <span className="period"> / mo</span>
            </div>
            <p className="damage-verdict" id="damageVerdict">Calculating…</p>
          </div>

          {/* LEADERBOARD */}
          <div className="leaderboard">
            <div className="lb-header">
              <div className="lb-title">The Leaderboard</div>
              <div className="lb-trade" id="lbTrade">Trade area · <b>—</b></div>
            </div>
            <div id="lbBody"></div>
          </div>

          {/* SUBMISSIONS LOG (sales-only) */}
          <div className="submissions-panel sales-only" id="submissionsPanel">
            <div className="submissions-header">
              <div>
                <div className="cost-eyebrow">User Activity</div>
                <div className="cost-title" style={{ marginBottom: 0 }}>URLs analyzed from the lead side</div>
              </div>
              <button type="button" className="submissions-clear" id="submissionsClear" title="Clear local activity log">Clear</button>
            </div>
            <div className="submissions-table-wrap">
              <table className="submissions-table" id="submissionsTable">
                <thead>
                  <tr>
                    <th style={{ width: 56 }}>#</th>
                    <th>Lead</th>
                    <th>Contact</th>
                    <th>Audit</th>
                    <th style={{ width: 110 }}>Damage</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 140 }}>Submitted</th>
                  </tr>
                </thead>
                <tbody id="submissionsBody"></tbody>
              </table>
            </div>
            <div className="submissions-note">
              Backed by <b>/api/leads</b> on the server — visible to every sales rep, not just this browser.
            </div>
          </div>

          {/* GAP BREAKDOWN */}
          <div className="gap-grid sales-only" id="gapGrid"></div>

          {/* COST MATH */}
          <div className="cost-panel sales-only">
            <div className="cost-eyebrow">The Math</div>
            <div className="cost-title">How we got to that number.</div>
            <div className="cost-rows" id="costRows"></div>
            <div
              style={{
                fontFamily: "var(--body)",
                fontSize: 13.5,
                color: "var(--gray-warm)",
                lineHeight: 1.55,
                padding: "14px 18px",
                background: "rgba(124, 179, 66, 0.06)",
                border: "1px solid rgba(124, 179, 66, 0.2)",
                borderRadius: 10,
              }}
            >
              <b style={{ color: "var(--lime)" }}>Heads up:</b> These are directional estimates based on your composite gap, conservative trade-area volume, and our industry-standard{" "}
              <b style={{ color: "var(--cream)" }}>$80 CPL benchmark</b> for automotive. Real cost depends on your make, market, and how aggressively you close. The strategy call gives you the precise numbers from your CRM and analytics.
            </div>
          </div>

          {/* FIXES */}
          <div className="fixes-panel sales-only">
            <div className="fixes-header">
              <div className="fixes-eyebrow">What I&apos;d Fix First</div>
              <div className="fixes-title" id="fixesTitle">Your Top 3 Gaps</div>
            </div>
            <ol className="fixes-list" id="fixesList"></ol>
          </div>

          <div className="cta-row">
            <button className="cta-primary" id="ctaBook">Book My Strategy Call →</button>
            <button className="cta-secondary" id="ctaEmail">Email My Report</button>
          </div>
        </div>
      </section>

      {/* Row dropdown menu (sales-only). Positioned in JS when opened. */}
      <div className="row-menu" id="rowMenu" role="menu" aria-hidden="true">
        <button type="button" className="row-menu-item" data-action="view" role="menuitem">View details</button>
        <div className="row-menu-divider" />
        <button type="button" className="row-menu-item" data-action="status-pending" role="menuitem">Set to pending</button>
        <button type="button" className="row-menu-item" data-action="status-confirmed" role="menuitem">Set to confirmed</button>
        <button type="button" className="row-menu-item" data-action="status-cancelled" role="menuitem">Set to cancelled</button>
      </div>

      {/* Lead details modal (sales-only). Body filled by JS when opened. */}
      <div className="lead-modal" id="leadModal" aria-hidden="true" role="dialog" aria-modal="true">
        <div className="lead-modal-backdrop" data-close="1"></div>
        <div className="lead-modal-card">
          <div className="lead-modal-topbar">
            <div className="cost-eyebrow">Lead detail</div>
            <button type="button" className="lead-modal-close" data-close="1" aria-label="Close">✕</button>
          </div>
          <div className="lead-modal-body" id="leadModalBody"></div>
        </div>
      </div>
    </>
  );
}
