import type { CrewId, CrewRole } from "./crew";
import type { Material, MaterialKind } from "./materials";
import settings from "@/content/club/settings.json";
import announcements from "@/content/club/announcements.json";
import events from "@/content/club/events.json";
import team from "@/content/club/team.json";
import contributors from "@/content/club/contributors.json";
import faq from "@/content/club/faq.json";
import home from "@/content/club/home.json";

/* ============================================================
   Everything the public site shows lives in content/club/*.json.
   Edit it at /keystatic (the content editor: npm run dev, then open localhost:3000/keystatic),
   or by hand. Epoch has its own: content/epoch/ and lib/epoch/config.ts.
   This file reads those files and tidies them (the editor saves every field; empty means "not set").
   ============================================================ */

export type Shape = "diamond" | "square" | "ring" | "triangle";
export type NodeColor = "blue" | "purple" | "mint" | "green";

export interface Recap { text: string; numbers?: { value: number; label: string }[]; photos?: string; video?: string; slides?: string; materials?: Material[] }
export interface ClubEventData { date: string; dateLabel?: string; href?: string; luma?: string; recap?: Recap; type: string; title: string; text: string; where: string; shape: Shape; color: NodeColor }
export interface TeamMember { name: string; role?: string; past?: string; group: "mentor" | "lead" | "member"; owner?: boolean; crew?: CrewRole[]; tags?: string[]; handle: string; photo?: string; githubAvatar?: boolean }
export interface Contributor { name: string; handle: string; photo?: string; githubAvatar?: boolean }

/** "", null and missing all mean "not set". */
const opt = (s?: string | null) => s || undefined;
const list = <T,>(xs?: T[] | null) => (xs?.length ? xs : undefined);

type Raw<T> = { [K in keyof T]?: unknown };
const KINDS: MaterialKind[] = ["slides", "recording", "code", "reading"];
// a recap shows once it has anything: the story, numbers, photos, a video, slides or other links
const recap = (r?: Raw<Recap> | null): Recap | undefined => {
  if (!r) return undefined;
  const numbers = list((r.numbers as { value: number | null; label: string }[] | undefined)?.filter((n) => n.value != null && n.label) as { value: number; label: string }[]);
  const materials = list((r.materials as { title?: string | null; url?: string | null; kind?: string | null }[] | undefined)
    ?.filter((m) => m.title && m.url).map((m) => ({ title: m.title!, url: m.url!, kind: KINDS.includes(m.kind as MaterialKind) ? (m.kind as MaterialKind) : "reading" })));
  const out: Recap = { text: (r.text as string) || "", numbers, photos: opt(r.photos as string), video: opt(r.video as string), slides: opt(r.slides as string), materials };
  return out.text || out.numbers || out.video || out.slides || out.materials ? out : undefined;
};
const person = <T extends { handle?: string | null; photo?: string | null; githubAvatar?: boolean }>(p: T) =>
  ({ ...p, handle: p.handle ?? "", photo: opt(p.photo), githubAvatar: p.githubAvatar === false ? false : undefined });

export const CLUB = {
  name: settings.name,
  university: settings.university,
  year: settings.year,
  githubOrg: settings.githubOrg ?? "", // shows the Projects section with live repos
  githubUrl: "https://github.com",
  // Where "Join the club" sends people (joinUrl), or a real club address (email) for a pre-filled email.
  // Until one is set the form says sign-ups aren't connected yet, instead of pretending to send.
  joinUrl: settings.joinUrl ?? "",
  lumaCalendar: settings.lumaCalendar ?? "",
  lumaEpochCalendar: settings.lumaEpochCalendar ?? "",
  email: settings.email ?? "",
  socials: settings.socials as { label: string; href: string }[],

  // A message shown above the site header (dismissible), between `from` and `until`.
  announcements: (announcements.announcements as { id: string; text: string; href?: string | null; from?: string | null; until?: string | null }[]).map((a) => ({ id: a.id, text: a.text, href: opt(a.href), from: opt(a.from), until: opt(a.until) })) as { id: string; text: string; href?: string; from?: string; until?: string }[],

  whatWeDo: home.whatWeDo,
  // shown as a `git diff --stat`; keep these to real numbers
  stats: home.stats as { value: number; file: string; label: string }[],
  learn: home.learn as { id: string; cmd: string; shape: Shape; color: NodeColor; title: string; text: string }[],

  // After an event, its recap shows on its page. Photos: photos-inbox/<event-slug>/ then `node scripts/photos.mjs`.
  events: (events.events as (Raw<ClubEventData> & { recap?: Raw<Recap> | null })[]).map((e) => ({
    date: e.date as string, dateLabel: opt(e.dateLabel as string), href: opt(e.href as string), luma: opt(e.luma as string), recap: recap(e.recap),
    type: e.type as string, title: e.title as string, text: e.text as string, where: e.where as string, shape: e.shape as Shape, color: e.color as NodeColor,
  })) as ClubEventData[],

  // The team. group "mentor": the Mentors row · "lead": the top row of five · "member": everyone else, in a fresh random order.
  // `crew` is their technical role and level (lib/crew.ts explains the roles); `tags` are extra hats like Tech or Media.
  team: (team.team as (Omit<TeamMember, "crew"> & { crew?: { role: string; level: string | number }[]; role?: string | null; past?: string | null })[]).map((m) => ({
    ...person(m), role: opt(m.role), past: opt(m.past), owner: m.owner || undefined, tags: list(m.tags),
    crew: list(m.crew?.map((c) => ({ role: c.role as CrewId, level: Number(c.level) as CrewRole["level"] }))),
  })) as TeamMember[],
  // People who've shaped the club over the years (past leads, alumni, and members who've pitched in).
  contributors: contributors.contributors.map(person) as Contributor[],
  faq: faq.faq as { q: string; a: string }[],
};

/** Short commit-style hash for an event. Used by the timeline and by the terminal's `git log`, so they match. */
export const commitHash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(7, "0").slice(0, 7); };
