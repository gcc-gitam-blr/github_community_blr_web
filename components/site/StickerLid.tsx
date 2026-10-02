"use client";
import { useRef } from "react";
import { Sticker, type StickerName } from "@/components/ui/Sticker";
import { Reveal } from "@/components/ui/Reveal";

/* A laptop lid covered in stickers — everyone's looks like this by the end of the year.
   Every sticker can be dragged around (mouse or touch); positions are percentages of the lid.
   They pop on in CSS (.pop) when the lid scrolls into view. */
const LAYOUT: { name: StickerName; x: number; y: number; size: number; tilt: number; alt: string }[] = [
  { name: "octocat", x: 6, y: 8, size: 118, tilt: -8, alt: "Octocat" },
  { name: "coder", x: 38, y: 4, size: 104, tilt: 6, alt: "Coder Octocat" },
  { name: "heart", x: 70, y: 10, size: 110, tilt: 10, alt: "Octocat with a heart" },
  { name: "jetpack", x: 4, y: 52, size: 108, tilt: 7, alt: "Jetpack Octocat" },
  { name: "riveter", x: 72, y: 54, size: 104, tilt: -9, alt: "Mona the Riveter" },
  { name: "skate", x: 50, y: 58, size: 96, tilt: -4, alt: "Skateboarding Octocat" },
  { name: "professor", x: 24, y: 60, size: 94, tilt: -12, alt: "Professor Octocat" },
];

/** Drag inside the lid: moves the sticker with the CSS `translate` property, kept within the lid's edges. */
function drag(e: React.PointerEvent<HTMLDivElement>, lid: HTMLDivElement | null) {
  if (!lid || e.button !== 0) return;
  const el = e.currentTarget, r = el.getBoundingClientRect();
  // keep clear of the lid's border, with room for the sticker to tilt back when it's dropped
  const o = lid.getBoundingClientRect(), m = lid.clientLeft + 6;
  const box = { left: o.left + m, top: o.top + m, right: o.right - m, bottom: o.bottom - m };
  const [tx, ty] = (el.style.translate || "0px 0px").split(" ").map((v) => parseFloat(v) || 0);
  const sx = e.clientX, sy = e.clientY;
  el.setPointerCapture(e.pointerId); el.classList.add("dragging");
  const move = (m: PointerEvent) => {
    const dx = Math.min(box.right - r.right, Math.max(box.left - r.left, m.clientX - sx));
    const dy = Math.min(box.bottom - r.bottom, Math.max(box.top - r.top, m.clientY - sy));
    el.style.translate = `${tx + dx}px ${ty + dy}px`;
  };
  const up = () => { el.classList.remove("dragging"); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
  el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
}

export function StickerLid() {
  const lid = useRef<HTMLDivElement>(null);
  return (
    <Reveal as="figure" group className="relative">
      <div ref={lid} className="relative aspect-[16/11] w-full overflow-hidden rounded-[26px] border-[6px] border-[#2b2e35] bg-[linear-gradient(145deg,#4a4f59,#2d3038_55%,#24272e)] shadow-[0_40px_60px_-30px_rgba(11,11,15,.55),inset_0_1px_0_rgba(255,255,255,.12)]">
        {/* the logo in the middle of the lid */}
        <svg viewBox="0 0 40 40" aria-hidden className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 opacity-40">
          <path d="M14 11v18M14 17c0 6 12 2 12 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          <g fill="#2d3038" stroke="#fff" strokeWidth="2.6"><circle cx="14" cy="11" r="3.2" /><circle cx="14" cy="29" r="3.2" /><circle cx="26" cy="27" r="3.2" /></g>
        </svg>
        {LAYOUT.map((s, i) => (
          <div key={s.name} onPointerDown={(e) => drag(e, lid.current)}
            className="pop absolute cursor-grab touch-none select-none active:cursor-grabbing"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: `clamp(64px, ${(s.size / 560) * 100}%, ${s.size}px)`, "--tilt": `${s.tilt}deg`, "--sd": `${0.1 + i * 0.07}s` } as React.CSSProperties}>
            <Sticker name={s.name} size={s.size} alt={s.alt} className="pointer-events-none !h-auto !w-full" />
          </div>
        ))}
      </div>
      {/* hinge + base edge */}
      <div aria-hidden className="mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-[14px] bg-[linear-gradient(#c9ccd2,#9ea2aa)] shadow-[0_10px_20px_-10px_rgba(0,0,0,.4)]" />
      <figcaption className="mt-4 text-center font-mono text-[13px] text-ink-3">drag the stickers around ↑</figcaption>
    </Reveal>
  );
}
