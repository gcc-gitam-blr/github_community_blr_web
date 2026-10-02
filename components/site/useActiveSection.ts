"use client";
import { useEffect, useState } from "react";

/* Which home-page section is in the middle of the screen right now (a "scroll spy").
   Returns "top" above the first section, and "" on other pages. */
export const HOME_SECTIONS = ["top", "github", "shipped", "about", "learn", "events", "gallery", "projects", "team", "faq", "join"];

export function useActiveSection(enabled: boolean) {
  const [id, setId] = useState(enabled ? "top" : "");
  useEffect(() => {
    if (!enabled) return;
    const els = HOME_SECTIONS.map((s) => document.getElementById(s)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setId(e.target.id);
    }, { rootMargin: "-45% 0px -50% 0px" }); // a thin band across the middle of the screen
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [enabled]);
  return enabled ? id : "";
}
