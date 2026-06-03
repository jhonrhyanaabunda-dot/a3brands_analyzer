// Decorative falling-meteor shower: 10 CSS-animated streaks that loop with
// staggered delays so the sky always has 1–2 meteors in motion.
// Positions/timings are seeded so they're stable between server and client.

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(70707);

const COUNT = 10;
const meteors = Array.from({ length: COUNT }, (_, i) => ({
  // start horizontal position — kept on the left so the sweep covers the view
  leftVw: +(-15 + rng() * 30).toFixed(1),
  // start vertical position — scattered across the upper portion of the sky
  topVh: +(rng() * 35).toFixed(1),
  // animation duration in seconds — slow, drifting sweep
  duration: +(9 + rng() * 8).toFixed(2),
  // delay before first run (spread across the loop)
  delay: +(rng() * 14).toFixed(2),
  // tail length — smaller streaks
  tail: +(70 + rng() * 90).toFixed(0),
  // streak thickness — thinner
  thickness: +(0.8 + rng() * 0.9).toFixed(2),
  key: i,
}));

export default function Meteors() {
  return (
    <div className="meteors" aria-hidden="true">
      {meteors.map((m) => (
        <span
          key={m.key}
          className="meteor"
          style={{
            left: `${m.leftVw}vw`,
            top: `${m.topVh}vh`,
            width: `${m.tail}px`,
            height: `${m.thickness}px`,
            animationDuration: `${m.duration}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
