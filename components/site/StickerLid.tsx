"use client";
import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { Sticker, type StickerName } from "@/components/ui/Sticker";

/* A laptop lid covered in stickers — everyone's looks like this by the end of the year.
   Every sticker can be dragged around; positions are percentages of the lid. */
const LAYOUT: { name: StickerName; x: number; y: number; size: number; tilt: number; alt: string }[] = [
  { name: "octocat", x: 6, y: 8, size: 118, tilt: -8, alt: "Octocat" },
  { name: "coder", x: 38, y: 4, size: 104, tilt: 6, alt: "Coder Octocat" },
  { name: "heart", x: 70, y: 10, size: 110, tilt: 10, alt: "Octocat with a heart" },
  { name: "jetpack", x: 4, y: 52, size: 108, tilt: 7, alt: "Jetpack Octocat" },
  { name: "riveter", x: 72, y: 54, size: 104, tilt: -9, alt: "Mona the Riveter" },
  { name: "skate", x: 50, y: 58, size: 96, tilt: -4, alt: "Skateboarding Octocat" },
  { name: "professor", x: 24, y: 60, size: 94, tilt: -12, alt: "Professor Octocat" },
];

export function StickerLid() {
  const lid = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  return (
    <figure className="relative">
      <div ref={lid} className="relative aspect-[16/11] w-full overflow-hidden rounded-[26px] border-[6px] border-[#2b2e35] bg-[linear-gradient(145deg,#4a4f59,#2d3038_55%,#24272e)] shadow-[0_40px_60px_-30px_rgba(11,11,15,.55),inset_0_1px_0_rgba(255,255,255,.12)]">
        {/* the logo in the middle of the lid */}
        <svg viewBox="0 0 40 40" aria-hidden className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 opacity-40">
          <path d="M14 11v18M14 17c0 6 12 2 12 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          <g fill="#2d3038" stroke="#fff" strokeWidth="2.6"><circle cx="14" cy="11" r="3.2" /><circle cx="14" cy="29" r="3.2" /><circle cx="26" cy="27" r="3.2" /></g>
        </svg>
        {LAYOUT.map((s, i) => (
          <motion.div key={s.name} drag={!reduce} dragConstraints={lid} dragElastic={0.15} dragMomentum={false}
            whileHover={{ scale: 1.06 }} whileDrag={{ scale: 1.12, zIndex: 20, rotate: 0 }}
            initial={reduce ? false : { opacity: 0, scale: 0.4, rotate: s.tilt * 3 }} whileInView={{ opacity: 1, scale: 1, rotate: s.tilt }} viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: i * 0.07 }}
            className="absolute cursor-grab touch-none active:cursor-grabbing" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `clamp(64px, ${(s.size / 560) * 100}%, ${s.size}px)` }}>
            <Sticker name={s.name} size={s.size} alt={s.alt} className="!h-auto !w-full" />
          </motion.div>
        ))}
      </div>
      {/* hinge + base edge */}
      <div aria-hidden className="mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-[14px] bg-[linear-gradient(#c9ccd2,#9ea2aa)] shadow-[0_10px_20px_-10px_rgba(0,0,0,.4)]" />
      <figcaption className="mt-4 text-center font-mono text-[13px] text-ink-3">drag the stickers around ↑</figcaption>
    </figure>
  );
}
