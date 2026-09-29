"use client";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { EPOCH } from "@/lib/epoch/config";

/** Link into /epoch that "transforms" the site: a black disc expands from the
    click point, swallows the page, and the fest takes over. */
export function EpochLink({ className = "", children, href = "/epoch" }: { className?: string; children: React.ReactNode; href?: string }) {
  const router = useRouter();
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const go = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // let the browser handle it
    e.preventDefault();
    setOrigin({ x: e.clientX, y: e.clientY });
    setTimeout(() => router.push(href), 750);
  };

  return (
    <>
      <a href={href} onClick={go} className={className}>{children}</a>
      <AnimatePresence>
        {origin && (
          <motion.div
            aria-hidden
            className="fixed inset-0 z-[200] grid place-items-center bg-night"
            initial={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }}
            animate={{ clipPath: `circle(150vmax at ${origin.x}px ${origin.y}px)` }}
            transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, duration: 0.3 }}
              className="font-display text-[clamp(56px,14vw,200px)] font-black lowercase tracking-[-0.07em] text-gold"
            >
              {EPOCH.name}<span className="text-white">_{EPOCH.edition}</span>
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
