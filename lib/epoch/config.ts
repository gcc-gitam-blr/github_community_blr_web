import type { Reward, Stall } from "./types";

/* ============================================================
   EDIT ME — Epoch fest settings.
   ============================================================ */
export const EPOCH = {
  name: "EPOCH",
  edition: "26",
  tagline: "The tech fest where every commit counts.",
  dates: "November 8–9",
  venue: "Bengaluru campus · In person",
  // The Epoch section opens on its own between these times. To force it on/off
  // set NEXT_PUBLIC_EPOCH_MODE=live | off in .env.local.
  opensAt: "2026-11-01T00:00:00+05:30",
  closesAt: "2026-11-10T23:59:59+05:30",
  welcomeCoins: 100,
  currency: "EPC", // Epoch Coins
  organiserCode: process.env.NEXT_PUBLIC_EPOCH_ORGANISER_CODE || "epoch-admin", // demo mode only
};

export function epochIsLive(now = new Date()): boolean {
  const mode = process.env.NEXT_PUBLIC_EPOCH_MODE;
  if (mode === "live") return true;
  if (mode === "off") return false;
  return now >= new Date(EPOCH.opensAt) && now <= new Date(EPOCH.closesAt);
}

export const SEED_STALLS: Stall[] = [
  { id: "git-quiz", name: "Git Quiz Booth", kind: "earn", coins: 40, zone: "Hall A", blurb: "Answer five Git questions. No googling, no mercy." },
  { id: "bug-bounty", name: "Bug Bounty Desk", kind: "earn", coins: 75, zone: "Lab 2", blurb: "Find the planted bug in our repo. Fastest fix wins extra." },
  { id: "pr-clinic", name: "First-PR Clinic", kind: "earn", coins: 60, zone: "Lab 3", blurb: "Open your very first pull request with a mentor beside you." },
  { id: "ctf", name: "Capture The Flag", kind: "earn", coins: 120, zone: "Lab 1", blurb: "Crack three flags before the clock runs out." },
  { id: "demo-day", name: "Demo Day Stage", kind: "earn", coins: 50, zone: "Auditorium", blurb: "Watch a project demo and rate it. Curiosity pays." },
  { id: "snack-bar", name: "Commit Café", kind: "spend", coins: 20, zone: "Lobby", blurb: "Chai, cold coffee and snacks. Priced in Epoch Coins." },
];

export const SEED_REWARDS: Reward[] = [
  { id: "sticker-pack", name: "Sticker Pack", cost: 60, stock: 200, blurb: "Octocat & friends. Your laptop's about to get louder." },
  { id: "tee", name: "Epoch Tee", cost: 250, stock: 60, blurb: "Limited run. Black, obviously." },
  { id: "hoodie", name: "Merge Hoodie", cost: 500, stock: 25, blurb: "For the ones who ship at 2 a.m." },
  { id: "mentor", name: "1:1 Mentor Hour", cost: 300, stock: 20, blurb: "An hour with a senior engineer, on any topic." },
  { id: "mystery", name: "Mystery Drop", cost: 150, stock: 40, blurb: "Nobody knows. Everybody's jealous." },
];
