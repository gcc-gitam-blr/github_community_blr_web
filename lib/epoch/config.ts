import type { Booth, Reward } from "./types";

/* ============================================================
   EDIT ME — Epoch settings.
   Anything marked PLACEHOLDER is not in the original plan; confirm it.
   ============================================================ */
export const EPOCH = {
  name: "epoch",
  edition: "26",
  org: "GITAM University Bengaluru",
  tagline: "Two days. One economy. Every commit counts.",
  month: "December 2026",
  dates: "December 2026 · dates to be announced",
  venue: "GITAM University, Bengaluru",

  // Ticket & coins — from the plan: ₹199 example, 1 INR = 2 coins (=> 398 coins).
  ticketPriceINR: 199, // "exact price subject to finalisation"
  coinsPerINR: 2,
  currency: "EPC",
  ticketUrl: "", // paste your payment / registration link (Razorpay, Google Form…). Empty = pay at the desk.

  // The Epoch section "opens" on its own between these times. To force it on/off
  // set NEXT_PUBLIC_EPOCH_MODE=live | off in .env.local.
  opensAt: "2026-12-01T00:00:00+05:30",
  closesAt: "2026-12-31T23:59:59+05:30",
  organiserCode: process.env.NEXT_PUBLIC_EPOCH_ORGANISER_CODE || "epoch-admin", // demo mode only
};

export const STARTER_COINS = EPOCH.ticketPriceINR * EPOCH.coinsPerINR;

export function epochIsLive(now = new Date()): boolean {
  const mode = process.env.NEXT_PUBLIC_EPOCH_MODE;
  if (mode === "live") return true;
  if (mode === "off") return false;
  return now >= new Date(EPOCH.opensAt) && now <= new Date(EPOCH.closesAt);
}

const B = (id: string, name: string, kind: Booth["kind"], category: Booth["category"], coins: number, blurb: string, optional = false): Booth =>
  ({ id, name, kind, category, coins, blurb, ...(optional ? { optional } : {}) });

/* Costs: the plan gives VR = 40 and a recharge reward of 20. Every other price is a PLACEHOLDER. */
export const BOOTHS: Booth[] = [
  // ── recharge points: one attempt per attendee, each ────────────────
  B("recharge-trivia", "Tech Trivia Point", "recharge", "Compete", 20, "Rapid-fire tech & GitHub trivia. One attempt, twenty coins."),
  B("recharge-puzzle", "Mini Code Puzzle Point", "recharge", "Compete", 20, "A five-minute coding puzzle. Solve it, get paid."),
  B("recharge-wheel", "Fortune Wheel of Challenges", "recharge", "Compete", 20, "Spin the wheel, take the challenge it lands on — beginner to expert."),
  B("recharge-git", "Git Speed Quiz Point", "recharge", "Compete", 20, "How fast can you reach for the right Git command?"),
  B("recharge-debug", "Debug Dash Point", "recharge", "Compete", 20, "Spot the bug before the timer does."),

  // ── spend booths (from the plan's interactive booths) ─────────────
  B("vr", "Virtual Reality Merge Zone", "spend", "Play", 40, "Two Oculus stations: Merge Master, Code Quest, Commit Carnival. Ten-minute slots."),
  B("octocat-splash", "Octocat Splash", "spend", "Make", 30, "Professional hand-painting of Octocat-inspired art, with UV-reactive paint."),
  B("cultural-photo", "Cultural Photo Booth", "free", "Explore", 0, "Pro lighting, Octocat cutouts, instant digital copies."),
  B("origami", "Origami Wonderland", "spend", "Make", 20, "Fold a paper laptop, robot or algorithm. Ten-minute guided sessions."),
  B("3d-print", "3D Printing Showcase", "spend", "Make", 30, "Write a script, generate a model, watch it print. Take a keychain home.", true),
  B("startup", "Startup Spotlight", "free", "Explore", 0, "Ten early-stage startup booths and the Pitch Perfect stage."),
  B("retro", "Retro Gaming Nexus", "spend", "Play", 40, "Arcade cabinets, Tekken, Mortal Kombat, Mario — plus the code behind the games."),
  B("git-escape", "Git Escape Challenge", "spend", "Compete", 60, "A 15-minute GitHub-themed escape room. Commit your way out."),
  B("fortune", "Fortune Teller Booth", "spend", "Explore", 20, "Tech tarot, printed fortunes, and “Commit Your Future”."),
  B("lottery", "Commit Lottery", "spend", "Play", 20, "Tickets for the two-day draw: gadgets and GitHub merchandise."),
  B("dart", "Dart Commit", "spend", "Play", 20, "Throw darts at a Git-command board. One-minute rounds."),
  B("jenga", "Pull and Stack", "spend", "Play", 30, "Giant Jenga with merge-conflict blocks that need teamwork."),
  B("blindfold", "Blindfolded Obstacle Course", "spend", "Play", 30, "Guide a blindfolded “programmer” through the firewall."),
  B("snake-ladder", "Human-Size Snake & Ladder", "spend", "Play", 30, "Be the game piece. Quiz answers decide your steps."),
  B("musical-chairs", "Reverse Musical Chairs", "spend", "Play", 20, "Debug a chair to remove it when the music stops.", true),
  B("coin-drop", "Coin Drop Challenge", "spend", "Play", 20, "Drop coins into slots to execute a commit-push-pull sequence."),
  B("act-backwards", "Act It Backwards", "spend", "Play", 20, "Tech charades, performed in reverse."),
  B("voiceover", "Voiceover to Dialogues or Songs", "spend", "Make", 20, "Dub tech-show clips or write coding-themed lyrics.", true),
  B("digital-art", "Digital Art Station", "spend", "Make", 20, "Tablets, AI-assisted art, and a live-voted competition."),
];

export const RECHARGE_POINTS = BOOTHS.filter((b) => b.kind === "recharge");
export const BOOTH_COUNT = 21; // interactive booths & experiences listed in the plan (incl. the Merchandise Stall)

/* Merchandise Stall — the plan lists tees, hoodies and Octocat stickers. Prices are PLACEHOLDERS. */
export const REWARDS: Reward[] = [
  { id: "sticker-pack", name: "Octocat Sticker Pack", cost: 40, stock: 200, blurb: "Octocat and event-specific designs for your laptop lid." },
  { id: "tee", name: "Epoch T-Shirt", cost: 180, stock: 80, blurb: "Event-branded tee, various sizes." },
  { id: "hoodie", name: "Epoch Hoodie", cost: 320, stock: 30, blurb: "Limited-edition GitHub-themed hoodie." },
];

export interface SessionItem { time: string; end?: string; title: string; kind: "Ceremony" | "Workshop" | "Competition" | "Booths" | "Talk" | "Break"; notes?: string[] }

/* The Plan of Action, straight from the document. */
export const SCHEDULE: { day: 1 | 2; label: string; items: SessionItem[] }[] = [
  { day: 1, label: "Day 1", items: [
    { time: "08:00", end: "08:30", title: "Inauguration Ceremony", kind: "Ceremony", notes: ["Welcome address", "Remarks by chief guests", "Schedule overview"] },
    { time: "08:30", end: "12:00", title: "“Fail-Proof Code” Challenge", kind: "Competition", notes: ["A standard problem with a twist", "Judged on efficiency, error handling, adaptability"] },
    { time: "09:00", end: "10:00", title: "Git & GitHub Basics", kind: "Workshop", notes: ["Version control", "init · add · commit · push · pull", "Collaborative workflows"] },
    { time: "10:30", end: "12:00", title: "Building Your GitHub Portfolio", kind: "Workshop", notes: ["Organising repositories", "Compelling READMEs", "GitHub Pages"] },
    { time: "12:00", end: "14:00", title: "Lunch break", kind: "Break" },
    { time: "14:00", end: "18:00", title: "Digital Art Hack: GitHub Profile Banners", kind: "Workshop", notes: ["Design tools intro", "Hands-on with mentors"] },
    { time: "14:00", end: "18:00", title: "Interactive booths open", kind: "Booths", notes: ["Spend coins, hit recharge points"] },
    { time: "16:00", end: "17:00", title: "Department of Placement presentation", kind: "Talk", notes: ["GitHub in professional development", "Q&A with industry recruiters"] },
  ] },
  { day: 2, label: "Day 2", items: [
    { time: "08:00", end: "10:00", title: "Advanced Git & Open-Source Contributions", kind: "Workshop", notes: ["Branching strategies", "Resolving merge conflicts", "Pull requests to real projects"] },
    { time: "08:30", end: "12:00", title: "“Code Auction” Challenge", kind: "Competition", notes: ["Budget your team", "Bid for coding tasks", "2.5 hours of building"] },
    { time: "10:30", end: "12:00", title: "Code Review & QA Workshop", kind: "Workshop", notes: ["Effective code reviews", "Automated testing & CI", "Quality in GitHub workflows"] },
    { time: "12:00", end: "14:00", title: "Lunch break", kind: "Break" },
    { time: "14:00", end: "18:00", title: "Booths & Digital Art Hack continue", kind: "Booths" },
    { time: "16:00", end: "17:00", title: "Guest speaker: a successful GitHub user", kind: "Talk", notes: ["Personal journey", "GitHub in the workplace", "Q&A"] },
    { time: "18:00", end: "19:00", title: "Winners, prizes & closing", kind: "Ceremony", notes: ["Winners of both days", "Prize distribution", "Networking & refreshments"] },
  ] },
];
