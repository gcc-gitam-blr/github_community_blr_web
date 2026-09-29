"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useState } from "react";
import { useClientValue } from "@/lib/useClientValue";
import { EpochCoin } from "./EpochCoin";

let webgl: boolean | undefined; // detected once per page
function canRender3D() {
  if (webgl === undefined) {
    try { const c = document.createElement("canvas"); webgl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { webgl = false; }
  }
  return webgl && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const Scene = dynamic(() => import("./Coin3DScene"), { ssr: false });

class Boundary extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** The 3D coin. Falls back to the flat SVG coin when WebGL is unavailable or motion is reduced. */
export function Coin3D({ size = 420 }: { size?: number }) {
  const ok = useClientValue(canRender3D, false);
  // the flat coin shows first; the 3D engine only starts once the visitor interacts (moves, touches,
  // scrolls or types), so it never competes with the page's first load
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!ok) return;
    const go = () => { setLive(true); off(); };
    const evs = ["pointermove", "pointerdown", "wheel", "touchstart", "keydown", "scroll"] as const;
    const off = () => evs.forEach((e) => window.removeEventListener(e, go));
    evs.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    return off;
  }, [ok]);
  const flat = <EpochCoin size={size * 0.72} detail />;
  return (
    <div style={{ width: size, height: size }} className="grid place-items-center" aria-hidden>
      {ok && live ? <Boundary fallback={flat}><Scene /></Boundary> : flat}
    </div>
  );
}
