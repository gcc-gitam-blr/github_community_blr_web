import type { Booth, Reward } from "./types";
import settings from "@/content/epoch/settings.json";
import schedule from "@/content/epoch/schedule.json";

/* ============================================================
   Epoch settings. Dates, venue, ticket, sponsors and the schedule live in content/epoch/
   (edit them at /keystatic). Coins, booths and the shop stay here: the database seeds them too.
   Anything marked PLACEHOLDER is not in the original plan; confirm it.
   ============================================================ */
export const EPOCH = {
  name: "epoch",
  edition: "26",
  org: "GITAM University Bengaluru",
  tagline: settings.tagline,
  month: settings.month,
  dates: settings.dates,
  venue: settings.venue,

  // Coins. Everyone gets `starterCoins` when the desk checks them in. The plan's example was
  // ₹199 → 398 coins, but the club hasn't decided the ticket price (it may be free), so the price
  // is separate: empty until it's decided, and then the site shows it.
  starterCoins: 398,
  ticketPriceINR: settings.ticketPriceINR as number | null,
  currency: "EPC",
  ticketUrl: settings.ticketUrl ?? "", // a payment / registration link. Empty = pay at the desk.

  // The Epoch section "opens" on its own between these times. To force it on/off
  // set NEXT_PUBLIC_EPOCH_MODE=live | off in .env.local.
  // startsAt: when the real dates are announced; the club site then shows "Epoch starts in N days".
  // Empty so we never count down to a guess.
  startsAt: settings.startsAt ?? "",
  opensAt: settings.opensAt,
  closesAt: settings.closesAt,
  organiserCode: process.env.NEXT_PUBLIC_EPOCH_ORGANISER_CODE || "epoch-admin", // demo mode only
};

/* Epoch sponsors. Empty until the club has some; the section then appears on the Epoch page. */
export const SPONSORS = (settings.sponsors as { name: string; url: string; logo?: string | null; tier?: string | null }[])
  .map((s) => ({ name: s.name, url: s.url, logo: s.logo || undefined, tier: s.tier || undefined }));

export const STARTER_COINS = EPOCH.starterCoins;
/** "₹199" once decided, otherwise "To be announced". */
export const priceLabel = () => (EPOCH.ticketPriceINR ? `₹${EPOCH.ticketPriceINR}` : "To be announced");

/** Days until Epoch starts, or null when the date isn't announced (or it has started). */
export function daysToEpoch(now = new Date()): number | null {
  if (!EPOCH.startsAt) return null;
  const d = Math.ceil((new Date(EPOCH.startsAt).getTime() - now.getTime()) / 864e5);
  return d > 0 ? d : null;
}

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

/* The Plan of Action, from content/epoch/schedule.json. */
export const SCHEDULE = (schedule.days as { day: string; label: string; items: (Omit<SessionItem, "end" | "notes"> & { end?: string | null; notes?: string[] })[] }[]).map((d) => ({
  day: Number(d.day) as 1 | 2, label: d.label,
  items: d.items.map((i): SessionItem => ({ time: i.time, end: i.end || undefined, title: i.title, kind: i.kind, notes: i.notes?.length ? i.notes : undefined })),
}));
