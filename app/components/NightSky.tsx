// Decorative galaxy: dense background stars + sparkle stars + many constellations.
// Star positions are seeded so they're stable between server render and client
// hydration (no Math.random() at render time).

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 1920;
const H = 1080;

const rng = mulberry32(20260603);

const bgStars = Array.from({ length: 220 }, () => ({
  cx: +(rng() * W).toFixed(1),
  cy: +(rng() * H).toFixed(1),
  r: +(0.3 + rng() * 1.2).toFixed(2),
  o: +(0.35 + rng() * 0.55).toFixed(2),
}));

const sparkles = Array.from({ length: 9 }, () => ({
  cx: +(rng() * W).toFixed(1),
  cy: +(rng() * H).toFixed(1),
  s: +(0.7 + rng() * 0.7).toFixed(2),
}));

type C = { points: [number, number][]; lines: [number, number][] };

const constellations: C[] = [
  // Orion (left)
  {
    points: [
      [220, 180], [270, 260], [340, 320], [430, 330], [500, 310],
      [380, 400], [450, 470], [520, 440],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7]],
  },
  // Cassiopeia (top center)
  {
    points: [[1080, 120], [1160, 170], [1220, 120], [1290, 180], [1360, 140]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  // Ursa Major / Big Dipper (top right)
  {
    points: [
      [1480, 170], [1560, 200], [1640, 230], [1720, 220],
      [1700, 300], [1620, 320],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 2]],
  },
  // Leo (lower-center)
  {
    points: [
      [900, 780], [980, 760], [1060, 800], [1100, 880],
      [1020, 920], [940, 880], [1180, 820], [1240, 780],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [2, 6], [6, 7]],
  },
  // Lyra (mid-left, small triangle + tail)
  {
    points: [[700, 600], [740, 640], [675, 660], [710, 720], [725, 790]],
    lines: [[0, 1], [1, 2], [2, 0], [1, 3], [3, 4]],
  },
  // Cygnus / Northern Cross (mid-right)
  {
    points: [[1500, 540], [1500, 600], [1500, 680], [1430, 600], [1570, 600]],
    lines: [[0, 1], [1, 2], [3, 1], [1, 4]],
  },
  // Scorpius (lower-left curve)
  {
    points: [
      [150, 800], [195, 830], [240, 850], [285, 845],
      [325, 880], [340, 940], [310, 990], [270, 985], [240, 945],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]],
  },
  // Sagittarius (teapot, lower mid-left)
  {
    points: [
      [490, 900], [540, 900], [540, 950], [490, 950],
      [445, 925], [460, 970],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5]],
  },
  // Gemini (upper right twins)
  {
    points: [
      [1740, 400], [1745, 460], [1750, 520],
      [1790, 410], [1795, 470], [1800, 530],
    ],
    lines: [[0, 1], [1, 2], [3, 4], [4, 5], [2, 5]],
  },
  // Pegasus (square, upper mid)
  {
    points: [[820, 200], [920, 200], [920, 280], [820, 280], [760, 170]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4]],
  },
  // Perseus (mid-right)
  {
    points: [[1460, 780], [1500, 800], [1540, 820], [1520, 880], [1480, 920]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  // Draco (top-right winding)
  {
    points: [
      [1650, 80], [1700, 110], [1750, 95], [1800, 130], [1850, 110],
      [1880, 70],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  // Aquila (eagle, lower mid-right diamond)
  {
    points: [[1200, 660], [1240, 710], [1200, 760], [1160, 710], [1280, 690]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4]],
  },
  // Ursa Minor / Little Dipper (upper-mid)
  {
    points: [
      [1280, 420], [1320, 430], [1360, 450], [1400, 440],
      [1390, 490], [1350, 500], [1310, 470],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 2]],
  },
  // Taurus (upper-left V)
  {
    points: [[540, 90], [580, 130], [620, 110], [660, 140], [700, 100]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
];

const cycle = (n: number, mod: number) => (n % mod) + mod * 0.0001;

export default function NightSky() {
  return (
    <svg
      className="constellations"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <g className="bg-stars">
        {bgStars.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} opacity={s.o} />
        ))}
      </g>

      <g className="sparkles">
        {sparkles.map((s, i) => (
          <g
            key={i}
            transform={`translate(${s.cx} ${s.cy}) scale(${s.s})`}
            style={{ animationDelay: `${cycle(i * 0.7, 5)}s` }}
          >
            <line x1="-11" y1="0" x2="11" y2="0" />
            <line x1="0" y1="-11" x2="0" y2="11" />
            <line x1="-5" y1="-5" x2="5" y2="5" opacity="0.45" />
            <line x1="-5" y1="5" x2="5" y2="-5" opacity="0.45" />
            <circle r="1.6" />
          </g>
        ))}
      </g>

      {constellations.map((c, idx) => (
        <g key={idx} className="constellation">
          {c.lines.map(([a, b], li) => {
            const [x1, y1] = c.points[a];
            const [x2, y2] = c.points[b];
            return <line key={li} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
          {c.points.map(([x, y], pi) => (
            <circle key={pi} cx={x} cy={y} r={1.6} />
          ))}
        </g>
      ))}
    </svg>
  );
}
