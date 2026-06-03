// Detailed SVG moon: heavily cratered surface, soft mottling, gentle limb shadow.
// Crater positions are seeded so they're stable across server/client renders.

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = 96; // disc radius inside the 200x200 viewBox (4px breathing room)
const CENTER = 100;

type Crater = { cx: number; cy: number; rx: number; ry: number; o: number };

function buildCraters(seed: number, target: number): Crater[] {
  const rng = mulberry32(seed);
  const out: Crater[] = [];
  let tries = 0;
  while (out.length < target && tries++ < 800) {
    const cx = 8 + rng() * 184;
    const cy = 8 + rng() * 184;
    const big = rng() < 0.18;
    const r = big ? 4 + rng() * 7 : 1.6 + rng() * 3.5;
    const dx = cx - CENTER;
    const dy = cy - CENTER;
    if (Math.sqrt(dx * dx + dy * dy) + r > R - 1) continue;
    const ar1 = 0.88 + rng() * 0.24;
    const ar2 = 0.88 + rng() * 0.24;
    out.push({
      cx: +cx.toFixed(1),
      cy: +cy.toFixed(1),
      rx: +(r * ar1).toFixed(2),
      ry: +(r * ar2).toFixed(2),
      o: +(0.45 + rng() * 0.4).toFixed(2),
    });
  }
  return out;
}

const craters = buildCraters(42424242, 48);

export default function Moon() {
  return (
    <div className="moon" aria-hidden="true">
      <svg
        className="moon-disc"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
      <defs>
        {/* Bright surface, subtle gradient — lit broadly from upper-left */}
        <radialGradient id="moonSurface" cx="42%" cy="38%" r="72%">
          <stop offset="0%" stopColor="#EFECE3" />
          <stop offset="60%" stopColor="#C6C1B7" />
          <stop offset="90%" stopColor="#8C8880" />
          <stop offset="100%" stopColor="#56524A" />
        </radialGradient>
        {/* Crater bowl — soft, slight rim highlight upper-left, dark center */}
        <radialGradient id="moonCrater" cx="32%" cy="30%" r="80%">
          <stop offset="0%" stopColor="rgba(195, 190, 180, 0.45)" />
          <stop offset="40%" stopColor="rgba(90, 86, 78, 0.55)" />
          <stop offset="100%" stopColor="rgba(36, 34, 28, 0.7)" />
        </radialGradient>
        {/* Soft limb darkening ring */}
        <radialGradient id="moonLimb" cx="50%" cy="50%" r="50%">
          <stop offset="72%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(8, 10, 18, 0.55)" />
        </radialGradient>
        {/* Faint directional shading at the lower-right */}
        <radialGradient id="moonShade" cx="78%" cy="80%" r="65%">
          <stop offset="0%" stopColor="rgba(15, 20, 28, 0.22)" />
          <stop offset="100%" stopColor="rgba(15, 20, 28, 0)" />
        </radialGradient>
      </defs>

      {/* Clip everything to the disc so craters near the rim get cut cleanly */}
      <defs>
        <clipPath id="moonClip">
          <circle cx={CENTER} cy={CENTER} r={R + 1} />
        </clipPath>
      </defs>

      <g clipPath="url(#moonClip)">
        {/* Base disc */}
        <circle cx={CENTER} cy={CENTER} r={R} fill="url(#moonSurface)" />

        {/* Mare — large faint dark "seas" for surface variation */}
        <ellipse cx="62" cy="78" rx="40" ry="30" fill="rgba(120, 115, 105, 0.18)" />
        <ellipse cx="130" cy="118" rx="36" ry="28" fill="rgba(110, 105, 95, 0.16)" />
        <ellipse cx="148" cy="60" rx="22" ry="18" fill="rgba(180, 175, 165, 0.10)" />
        <ellipse cx="90" cy="158" rx="28" ry="22" fill="rgba(120, 115, 105, 0.14)" />
        <ellipse cx="40" cy="120" rx="18" ry="14" fill="rgba(140, 135, 125, 0.10)" />

        {/* Crater field — generated, dense, varied sizes */}
        {craters.map((c, i) => (
          <ellipse
            key={i}
            cx={c.cx}
            cy={c.cy}
            rx={c.rx}
            ry={c.ry}
            fill="url(#moonCrater)"
            opacity={c.o}
          />
        ))}

        {/* Directional shade + limb darkening */}
        <circle cx={CENTER} cy={CENTER} r={R} fill="url(#moonShade)" />
        <circle cx={CENTER} cy={CENTER} r={R} fill="url(#moonLimb)" />
      </g>
      </svg>
    </div>
  );
}
