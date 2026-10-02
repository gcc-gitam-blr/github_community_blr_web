"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { EPOCH } from "@/lib/epoch/config";

/** Link into /epoch that "transforms" the site: a black disc expands from the
    click point, swallows the page, and the fest takes over. Pure CSS (.epoch-wipe in globals.css).
    The disc is rendered at the end of <body>: inside the glass header (backdrop-filter) a fixed layer would be
    trapped in the header's box instead of covering the screen. */
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
      {origin && createPortal(
        <div aria-hidden className="epoch-wipe fixed inset-0 z-[200] grid place-items-center bg-night" style={{ "--x": `${origin.x}px`, "--y": `${origin.y}px` } as React.CSSProperties}>
          <span className="epoch-wipe__word font-display text-[clamp(56px,14vw,200px)] font-black lowercase tracking-[-0.07em] text-gold">
            {EPOCH.name}<span className="text-white">_{EPOCH.edition}</span>
          </span>
        </div>,
        document.body,
      )}
    </>
  );
}
