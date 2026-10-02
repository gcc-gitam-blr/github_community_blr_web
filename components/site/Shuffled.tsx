"use client";
import { Children, isValidElement } from "react";
import { useClientValue } from "@/lib/useClientValue";

/* Shows its children in a fresh random order on every visit, so no order reads as a ranking.
   The server (and the first paint) use the written order; the browser then shuffles with a seed picked once per page load. */
const SEED = typeof window === "undefined" ? 0 : Math.floor(Math.random() * 2 ** 31) + 1;

/** Fisher–Yates with a small seeded generator (mulberry32), so every render of one visit agrees. */
export function shuffle<T>(items: T[], seed: number): T[] {
  if (!seed) return items;
  const out = [...items];
  let a = seed;
  const rand = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function Shuffled({ children, className }: { children: React.ReactNode; className?: string }) {
  const seed = useClientValue(() => SEED, 0);
  const items = Children.toArray(children).filter(isValidElement);
  return <ul className={className}>{shuffle(items, seed)}</ul>;
}
