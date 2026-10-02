import { BOOTHS, BOOTH_COUNT, EPOCH, RECHARGE_POINTS, REWARDS, SCHEDULE, STARTER_COINS } from "./config";

/* The brain behind the command bar. Pure and deterministic: it searches the real
   config (booths, plan, pages) and answers common questions from it. No external AI. */

export interface Hit { id: string; kind: "page" | "booth" | "plan" | "merch" | "answer"; title: string; sub?: string; href?: string }

export const PAGES: Hit[] = [
  { id: "p-home", kind: "page", title: "Epoch home", href: "/epoch" },
  { id: "p-wallet", kind: "page", title: "My wallet", sub: "Balance, ledger, recharge points", href: "/epoch/wallet" },
  { id: "p-booths", kind: "page", title: "Booths", sub: `${BOOTH_COUNT} places to spend coins`, href: "/epoch/booths" },
  { id: "p-shop", kind: "page", title: "Merch shop", sub: "Tees, hoodies, stickers", href: "/epoch/shop" },
  { id: "p-board", kind: "page", title: "Leaderboard", sub: "Top earners", href: "/epoch/leaderboard" },
  { id: "p-scan", kind: "page", title: "Scan a booth", sub: "Camera scanner", href: "/epoch/scan" },
  { id: "p-register", kind: "page", title: "Get your ticket", sub: "Create a profile", href: "/epoch/register" },
  { id: "p-club", kind: "page", title: "Back to the club site", href: "/" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9₹ ]+/g, " ").replace(/\s+/g, " ").trim();
const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

/** Rule-based answers to the questions people actually ask. Returns null if nothing matches. */
export function answer(raw: string): Hit | null {
  const q = norm(raw); if (q.length < 3) return null;
  const A = (title: string, sub: string, href?: string): Hit => ({ id: "a-" + title, kind: "answer", title, sub, href });

  const booth = BOOTHS.find((b) => q.includes(norm(b.name)) || (b.id.length > 2 && b.id !== "vr" && q.includes(b.id.replace(/-/g, " "))) || (b.id === "vr" && /\bvr\b|virtual/.test(q)));
  if (booth && has(q, "cost", "price", "how much", "coins", "pay", "worth", "earn")) {
    return booth.kind === "recharge" ? A(`${booth.name} pays +${booth.coins} coins`, "Once per person — one attempt at each recharge point.", "/epoch/booths")
      : booth.kind === "free" ? A(`${booth.name} is free`, booth.blurb, "/epoch/booths")
      : A(`${booth.name} costs ${booth.coins} coins per session`, booth.blurb, "/epoch/booths");
  }
  if (has(q, "recharge", "top up", "topup", "run out", "low on coins", "more coins", "earn")) return A(`Recharge points give +${RECHARGE_POINTS[0].coins} coins, once each`, `There are ${RECHARGE_POINTS.length}: ${RECHARGE_POINTS.map((p) => p.name.replace(" Point", "")).join(", ")}. Your wallet shows how many you have left.`, "/epoch/booths");
  if (has(q, "ticket", "398", "199", "how many coins", "starting coins", "convert", "rate", "1 inr", "rupee", "price", "free") || (has(q, "coins") && has(q, "get", "start", "receive"))) return A(`Everyone starts with ${STARTER_COINS} coins`, `The desk checks you in and credits ${STARTER_COINS} ${EPOCH.currency}, once. ${EPOCH.ticketPriceINR ? `Ticket: ₹${EPOCH.ticketPriceINR}.` : "The ticket price (if any) hasn't been decided yet."}`, "/epoch/register");
  if (has(q, "merch", "hoodie", "shirt", "tee", "sticker")) return A("Merch is bought with coins", REWARDS.map((r) => `${r.name} ${r.cost}`).join(" · "), "/epoch/shop");
  if (has(q, "when", "date", "schedule", "plan", "time", "day 1", "day 2", "agenda", "start")) return A(`${EPOCH.month} · two days`, `${EPOCH.dates}. Workshops and contests in the morning, booths from 2 PM, closing ceremony 6 PM on day two.`, "/epoch#plan");
  if (has(q, "where", "venue", "location", "campus")) return A(EPOCH.venue, "Details on the day will be shared on the site.");
  if (has(q, "how many booth", "booths")) return A(`${BOOTH_COUNT} booths & experiences`, "VR, escape room, retro arcade, 3D printing, art, games and more.", "/epoch/booths");
  if (has(q, "leaderboard", "rank", "top", "winner")) return A("Leaderboard ranks coins earned", "Recharge points and prizes count; spending never lowers your rank.", "/epoch/leaderboard");
  if (has(q, "lottery")) return A("Commit Lottery", BOOTHS.find((b) => b.id === "lottery")!.blurb, "/epoch/booths");
  return null;
}

/** Matches for the typed query, best first. With an empty query returns friendly defaults. */
export function search(raw: string, limit = 8): Hit[] {
  const q = norm(raw);
  if (!q) return [PAGES[1], PAGES[2], PAGES[3], PAGES[6]];
  const score = (text: string) => { const t = norm(text); return t === q ? 4 : t.startsWith(q) ? 3 : t.includes(q) ? 2 : q.split(" ").every((w) => t.includes(w)) ? 1 : 0; };
  const pool: (Hit & { s: number })[] = [
    ...PAGES.map((p) => ({ ...p, s: score(p.title + " " + (p.sub ?? "")) })),
    ...BOOTHS.map((b): Hit & { s: number } => ({ id: b.id, kind: "booth", title: b.name, sub: b.kind === "recharge" ? `Recharge point · +${b.coins} once` : b.kind === "free" ? "Free" : `${b.category} · −${b.coins} / session`, href: "/epoch/booths", s: score(b.name + " " + b.id.replace(/-/g, " ") + " " + b.blurb + " " + b.category) })),
    ...REWARDS.map((r): Hit & { s: number } => ({ id: r.id, kind: "merch", title: r.name, sub: `${r.cost} coins`, href: "/epoch/shop", s: score(r.name) })),
    ...SCHEDULE.flatMap((d) => d.items.map((it, i): Hit & { s: number } => ({ id: `plan-${d.day}-${i}`, kind: "plan", title: it.title, sub: `${d.label} · ${it.time}`, href: "/epoch#plan", s: score(it.title + " " + (it.notes ?? []).join(" ")) }))),
  ];
  const hits = pool.filter((h) => h.s > 0).sort((a, b) => b.s - a.s).slice(0, limit);
  const a = answer(raw);
  return a ? [a, ...hits.slice(0, limit - 1)] : hits;
}
