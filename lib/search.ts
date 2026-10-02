import { CLUB } from "./config";
import { EVENTS, eventDate, eventSlug } from "./events";
import { CHEAT } from "./learn";

/* Site search (press / or Ctrl+K): everything worth jumping to, ranked by a small, predictable scorer.
   Pure functions — the index is built from config, and update posts arrive from /search.json. */
export type Kind = "Page" | "Section" | "Event" | "Update" | "Question" | "Git command";
export interface Entry { kind: Kind; title: string; hint: string; href: string; keywords?: string }

const PAGES: Entry[] = [
  { kind: "Page", title: "Home", hint: "The club, events and how to join", href: "/", keywords: "start" },
  { kind: "Page", title: "Learn hub", hint: "A path from your first commit, plus a cheat sheet", href: "/learn", keywords: "tutorial course guide beginner" },
  { kind: "Page", title: "Contribute", hint: "Beginner-friendly issues to work on", href: "/contribute", keywords: "open source good first issue pull request" },
  { kind: "Page", title: "Get involved", hint: "Volunteer, speak, sponsor, apply to the core team", href: "/get-involved", keywords: "contact message apply speaker sponsor team" },
  { kind: "Page", title: "Updates", hint: "Club news and what GitHub shipped lately", href: "/updates", keywords: "news blog changelog rss" },
  { kind: "Page", title: "Epoch", hint: "The December fest and its coin economy", href: "/epoch", keywords: "fest coins booths ticket wallet" },
  { kind: "Page", title: "Privacy", hint: "What we store and why", href: "/privacy", keywords: "data cookies" },
];
const SECTIONS: Entry[] = [
  { kind: "Section", title: "New to GitHub?", hint: "What GitHub is and why learn it", href: "/#github", keywords: "beginner what is git" },
  { kind: "Section", title: "What GitHub shipped lately", hint: "Headlines from the GitHub Changelog", href: "/#shipped", keywords: "changelog new features copilot" },
  { kind: "Section", title: "About the club", hint: "Who we are and what we do", href: "/#about", keywords: "community gitam" },
  { kind: "Section", title: "Events calendar", hint: "The 2026-27 year at a glance", href: "/#events", keywords: "calendar schedule dates luma rsvp" },
  { kind: "Section", title: "Team", hint: "The people running the club", href: "/#team", keywords: "core team lead organisers" },
  { kind: "Section", title: "FAQ", hint: "Common questions", href: "/#faq", keywords: "questions help" },
  { kind: "Section", title: "Join the club", hint: "Sign up with your GitHub username", href: "/#join", keywords: "register sign up member whatsapp" },
];

export function baseIndex(): Entry[] {
  const events: Entry[] = EVENTS.map((e) => ({ kind: "Event", title: e.title, hint: `${eventDate(e)} · ${e.type}`, href: e.href ?? `/events/${eventSlug(e)}`, keywords: `${e.text} ${e.type}` }));
  const faq: Entry[] = CLUB.faq.map((f) => ({ kind: "Question", title: f.q, hint: f.a.length > 90 ? f.a.slice(0, 87).replace(/\s+\S*$/, "") + "…" : f.a, href: "/#faq", keywords: f.a }));
  const cmds: Entry[] = CHEAT.flatMap((g) => g.cmds.map((c) => ({ kind: "Git command" as const, title: c.cmd, hint: c.what, href: `/learn?q=${encodeURIComponent(c.cmd.split(" ").slice(0, 2).join(" "))}#cheat`, keywords: `${g.group} ${c.what}` })));
  return [...PAGES, ...SECTIONS, ...events, ...faq, ...cmds];
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, " ");
const ORDER: Kind[] = ["Page", "Section", "Event", "Update", "Question", "Git command"];

/** Every word of the query must appear; titles beat hints beat keywords; starts-of-words beat the middle. */
export function search(index: Entry[], query: string, limit = 12): Entry[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return index.filter((e) => e.kind === "Page" || e.kind === "Section").slice(0, limit);
  const scored: { e: Entry; s: number }[] = [];
  for (const e of index) {
    const title = norm(e.title), hint = norm(e.hint), keys = norm(e.keywords ?? "");
    let s = 0, all = true;
    for (const w of words) {
      const inTitle = title.indexOf(w), atWord = new RegExp(`(^|[\\s-])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(title);
      if (inTitle >= 0) s += atWord ? (inTitle === 0 ? 12 : 9) : 5;
      else if (hint.includes(w)) s += 3;
      else if (keys.includes(w)) s += 1;
      else { all = false; break; }
    }
    if (all) scored.push({ e, s: s - title.length / 200 }); // shorter titles win ties
  }
  return scored.sort((a, b) => b.s - a.s || ORDER.indexOf(a.e.kind) - ORDER.indexOf(b.e.kind)).slice(0, limit).map((x) => x.e);
}
