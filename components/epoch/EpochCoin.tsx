import { useId } from "react";

/* The Epoch coin, drawn properly.
   - reeded edge (the ticks), bevelled rim, domed face with a soft gloss
   - an embossed lowercase “e” whose crossbar is a commit line, ending in a commit node
   - “EPOCH · 2026” engraved around the rim at larger sizes                              */

/** Markup only (no ids clash): used for the SVG component, the standalone asset and the 3D texture. */
export function coinSVGMarkup(uid = "c", detail = true): string {
  const d = `M66 100H134A34 34 0 1 0 126 121.9`; // e: crossbar + open ring
  return `
  <defs>
    <linearGradient id="${uid}rim" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#fff3bf"/><stop offset=".3" stop-color="#ffd34d"/><stop offset=".62" stop-color="#e0a000"/><stop offset="1" stop-color="#8a5a00"/>
    </linearGradient>
    <linearGradient id="${uid}bevel" x1="0.9" y1="1" x2="0.1" y2="0">
      <stop offset="0" stop-color="#fff0b0"/><stop offset=".5" stop-color="#e7a800"/><stop offset="1" stop-color="#9a6500"/>
    </linearGradient>
    <radialGradient id="${uid}face" cx=".34" cy=".28" r=".95">
      <stop offset="0" stop-color="#ffe88f"/><stop offset=".5" stop-color="#ffc933"/><stop offset="1" stop-color="#d69100"/>
    </radialGradient>
    <radialGradient id="${uid}gloss" cx=".3" cy=".22" r=".7">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <path id="${uid}top" d="M 24 100 A 76 76 0 0 1 176 100"/>
    <path id="${uid}bot" d="M 22 100 A 78 78 0 0 0 178 100"/>
  </defs>
  <circle cx="100" cy="100" r="99" fill="url(#${uid}rim)"/>
  <circle cx="100" cy="100" r="95.5" fill="none" stroke="#7a4f00" stroke-opacity=".55" stroke-width="5" stroke-dasharray="1.7 4.4"/>
  <circle cx="100" cy="100" r="90" fill="url(#${uid}bevel)"/>
  <circle cx="100" cy="100" r="85" fill="url(#${uid}face)"/>
  <circle cx="100" cy="100" r="85" fill="url(#${uid}gloss)"/>
  <circle cx="100" cy="100" r="73" fill="none" stroke="#a86f00" stroke-opacity=".55" stroke-width="1.4"/>
  <circle cx="100" cy="100" r="71.5" fill="none" stroke="#fff4bd" stroke-opacity=".6" stroke-width="1"/>
  ${detail ? `
  <g font-family="Inter, Arial, sans-serif" font-weight="700" font-size="11" letter-spacing="3.2" fill="#8a5a00" fill-opacity=".85">
    <text><textPath href="#${uid}top" startOffset="50%" text-anchor="middle">EPOCH COIN</textPath></text>
    <text><textPath href="#${uid}bot" startOffset="50%" text-anchor="middle">GITAM · 2026</textPath></text>
  </g>` : ""}
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${d}" transform="translate(1.2 1.8)" stroke="#fff2b3" stroke-opacity=".8" stroke-width="12"/>
    <path d="${d}" stroke="#7a4f00" stroke-width="12"/>
    <path d="${d}" stroke="#a86f00" stroke-width="12" stroke-opacity=".0"/>
  </g>
  <circle cx="126" cy="121.9" r="9.5" fill="#ffe58a" stroke="#7a4f00" stroke-width="5"/>
  <circle cx="123.6" cy="119.4" r="2.6" fill="#fff" fill-opacity=".9"/>`;
}

/** The coin as an inline SVG. `detail` adds the engraved lettering (turned off automatically when small). */
export function EpochCoin({ size = 64, detail, className }: { size?: number; detail?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden className={`flex-none ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: coinSVGMarkup(uid, detail ?? size >= 110) }} />
  );
}

/** Standalone SVG document (used for /public/epoch-coin.svg and the 3D texture). */
export const coinSVGDocument = (px = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${px}" height="${px}">${coinSVGMarkup("t", true)}</svg>`;
