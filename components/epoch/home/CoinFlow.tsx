import { EPOCH, RECHARGE_POINTS, STARTER_COINS } from "@/lib/epoch/config";

/* The economy as a diagram: ticket → wallet → booths, with recharge points
   feeding coins back in. Coins travel along the paths (SVG animateMotion). */
const Node = ({ x, y, w = 220, h = 96, title, sub, tone }: { x: number; y: number; w?: number; h?: number; title: string; sub: string; tone: "gold" | "lilac" | "mint" | "plain" }) => {
  const stroke = { gold: "#ffc933", lilac: "#b48be6", mint: "#4fd1a1", plain: "rgba(255,255,255,.25)" }[tone];
  return (
    <g transform={`translate(${x - w / 2} ${y - h / 2})`}>
      <rect width={w} height={h} rx={26} fill="#12121f" stroke={stroke} strokeWidth={2.5} />
      <text x={w / 2} y={h / 2 - 4} textAnchor="middle" fill="#fff" fontSize={32} fontWeight={800} fontFamily="var(--font-outfit)">{title}</text>
      <text x={w / 2} y={h / 2 + 26} textAnchor="middle" fill="#a3a4bd" fontSize={19} fontFamily="var(--font-inter)">{sub}</text>
    </g>
  );
};

/* opacity stays 0 until the coin starts moving, so nothing is parked at the origin */
const Dot = ({ path, dur, delay = 0 }: { path: string; dur: number; delay?: number }) => (
  <circle r={9} fill="#ffc933" stroke="#7a4f00" strokeWidth={3} opacity={0}>
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.92;1" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
    <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"><mpath href={`#${path}`} /></animateMotion>
  </circle>
);

export function CoinFlow() {
  return (
    <svg viewBox="0 0 1000 400" className="w-full" role="img" aria-label={`Ticket of ₹${EPOCH.ticketPriceINR} becomes ${STARTER_COINS} Epoch Coins in your wallet. Spend them at booths, or earn ${RECHARGE_POINTS[0].coins} at each recharge point, once.`}>
      <defs>
        <path id="p-ticket" d="M255 200 H365" />
        <path id="p-spend" d="M632 178 C700 178 690 80 735 80" />
        <path id="p-recharge" d="M735 320 C690 320 700 222 632 222" />
      </defs>
      {["p-ticket", "p-spend", "p-recharge"].map((id) => <use key={id} href={`#${id}`} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth={3} className="flow-path" />)}

      <Node x={150} y={200} w={210} title={`₹${EPOCH.ticketPriceINR}`} sub="your ticket" tone="plain" />
      <Node x={500} y={200} w={270} h={130} title={`${STARTER_COINS} ${EPOCH.currency}`} sub="your live wallet" tone="gold" />
      <Node x={870} y={80} w={260} title="Spend" sub="VR −40 · games · merch" tone="lilac" />
      <Node x={870} y={320} w={260} title="Recharge" sub={`+${RECHARGE_POINTS[0].coins} · once per point`} tone="mint" />

      <text x={310} y={178} textAnchor="middle" fill="#ffc933" fontSize={28} fontWeight={800} fontFamily="var(--font-jbm)">×{EPOCH.coinsPerINR}</text>

      <Dot path="p-ticket" dur={2.2} /><Dot path="p-ticket" dur={2.2} delay={1.1} />
      <Dot path="p-spend" dur={2.6} /><Dot path="p-spend" dur={2.6} delay={1.3} />
      <Dot path="p-recharge" dur={2.6} delay={0.6} /><Dot path="p-recharge" dur={2.6} delay={1.9} />
    </svg>
  );
}
