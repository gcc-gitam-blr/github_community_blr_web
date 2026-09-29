"use client";
import { useRef } from "react";

/** Card with a green light that follows the cursor. */
export function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty("--mx", `${e.clientX - r.left}px`);
    ref.current!.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onPointerMove={move} className={`relative h-full overflow-hidden transition duration-500 hover:-translate-y-2 hover:border-ink hover:shadow-[0_8px_30px_-12px_rgba(11,11,15,.18)] before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300 before:[background:radial-gradient(320px_circle_at_var(--mx,50%)_var(--my,50%),rgba(63,200,78,.16),transparent_70%)] hover:before:opacity-100 ${className}`}>
      {children}
    </div>
  );
}
