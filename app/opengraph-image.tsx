import { ImageResponse } from "next/og";

/* The preview card shown when the site link is shared (WhatsApp, LinkedIn, Discord…). */
export const alt = "GitHub Community Club · GITAM Bengaluru — Code. Collaborate. Contribute.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const Node = ({ x, y, fill }: { x: number; y: number; fill: string }) => (
  <div style={{ position: "absolute", left: x - 26, top: y - 26, width: 52, height: 52, borderRadius: 52, background: fill, border: "6px solid #0b0b0f" }} />
);

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", padding: 72, position: "relative", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
          <div style={{ display: "flex", fontSize: 26, color: "#3a3d44" }}>GITAM University Bengaluru · GitHub Community Club</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 104, fontWeight: 900, lineHeight: 0.95, letterSpacing: -4, color: "#0b0b0f" }}>
            <span>Code.</span><span>Collaborate.</span><span>Contribute&gt;_</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26 }}>
            <span style={{ background: "#0b0b0f", color: "#ffc933", padding: "8px 18px", borderRadius: 40, fontWeight: 700 }}>epoch_26</span>
            <span style={{ color: "#3a3d44" }}>December 2026 · ₹199 → 398 coins</span>
          </div>
        </div>
        {/* the git graph */}
        <div style={{ position: "absolute", right: 120, top: 120, width: 260, height: 420, display: "flex" }}>
          <div style={{ position: "absolute", left: 128, top: 0, width: 8, height: 330, background: "#0b0b0f" }} />
          <div style={{ position: "absolute", left: 128, top: 60, width: 100, height: 8, background: "#0b0b0f" }} />
          <div style={{ position: "absolute", left: 220, top: 60, width: 8, height: 160, background: "#0b0b0f" }} />
          <div style={{ position: "absolute", left: 30, top: 250, width: 100, height: 8, background: "#0b0b0f" }} />
          <div style={{ position: "absolute", left: 30, top: 250, width: 8, height: 160, background: "#0b0b0f" }} />
          <Node x={132} y={20} fill="#b9e0f7" /><Node x={132} y={130} fill="#b9e0f7" /><Node x={224} y={130} fill="#b48be6" />
          <Node x={224} y={220} fill="#b48be6" /><Node x={132} y={250} fill="#b9e0f7" /><Node x={34} y={310} fill="#4fd1a1" /><Node x={34} y={400} fill="#4fd1a1" />
        </div>
      </div>
    ),
    size,
  );
}
