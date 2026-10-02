"use client";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/* The "heavy", expensive-feeling scroll: wheel input is eased with inertia (Lenis) instead of
   jumping in steps. Touch keeps the native feel. Off entirely for prefers-reduced-motion.
   In-page #links glide there too, landing below the fixed nav. */
let lenis: Lenis | null = null;
export const scrollToTarget = (target: string | HTMLElement, offset = -76) => {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.3 });
  else (typeof target === "string" ? document.querySelector(target) : target)?.scrollIntoView({ behavior: "smooth" });
};

export function SmoothScroll() {
  const path = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: -76 }, prevent: (node) => !!node.closest("[data-lenis-prevent], [role='dialog']") });
    let raf = 0;
    const loop = (t: number) => { lenis?.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis?.destroy(); lenis = null; };
  }, []);

  // new page: start at the top, without a smooth scroll back up
  useEffect(() => { lenis?.scrollTo(0, { immediate: true }); }, [path]);
  return null;
}
