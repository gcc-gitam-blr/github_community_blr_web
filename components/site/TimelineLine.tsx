"use client";
import { useEffect, useRef } from "react";

/** Timeline whose black line fills as you scroll through it. */
export function TimelineLine({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const update = () => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--p", String(Math.max(0, Math.min(1, (window.innerHeight * 0.6 - r.top) / r.height))));
    };
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return (
    <ol ref={ref} className="relative grid max-w-[900px] gap-[34px] before:absolute before:bottom-5 before:top-5 before:w-1 before:rounded before:bg-line after:absolute after:bottom-5 after:top-5 after:w-1 after:origin-top after:scale-y-[var(--p,0)] after:rounded after:bg-ink before:left-4 after:left-4 sm:before:left-[21px] sm:after:left-[21px]">
      {children}
    </ol>
  );
}
