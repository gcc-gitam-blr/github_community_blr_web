import { ImageResponse } from "next/og";
import { EPOCH, STARTER_COINS } from "@/lib/epoch/config";

export const alt = "epoch_26 — two days, one currency. GITAM Bengaluru.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f4f1ea", padding: 72, alignItems: "center", justifyContent: "space-between", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 26, color: "#6c6b7a" }}>GitHub Community Club · {EPOCH.org}</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 112, fontWeight: 500, lineHeight: 0.95, letterSpacing: -5, color: "#0b0b0f" }}>
            <span>Two days.</span><span>One currency.</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#3a3d44" }}>₹{EPOCH.ticketPriceINR} ticket → {STARTER_COINS} Epoch Coins · {EPOCH.month}</div>
        </div>
        {/* the coin */}
        <div style={{ width: 300, height: 300, borderRadius: 300, background: "#c98a00", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 272, height: 272, borderRadius: 272, background: "#ffc933", border: "4px dashed #c98a00", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 190, fontWeight: 800, color: "#7a4f00" }}>e</div>
        </div>
      </div>
    ),
    size,
  );
}
