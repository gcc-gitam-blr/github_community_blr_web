"use client";
import { useEffect } from "react";
import { OFF_KEY, ORGANISER_KEY, shortcutFor } from "@/lib/shortcuts";

/* Listens for the organisers' one-key jumps (lib/shortcuts.ts explains the rules). Renders nothing. */
export function Shortcuts() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      let enabled = false;
      try { enabled = localStorage.getItem(ORGANISER_KEY) === "1" && localStorage.getItem(OFF_KEY) !== "1"; } catch { /* storage blocked: no shortcuts */ }
      if (!enabled || document.querySelector("dialog[open]")) return;
      const href = shortcutFor({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, repeat: e.repeat, defaultPrevented: e.defaultPrevented, target: e.target as HTMLElement | null }, window.location.pathname);
      if (href) { e.preventDefault(); window.location.assign(href); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return null;
}
