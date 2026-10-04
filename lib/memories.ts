import data from "@/content/memories.json";
import gallery from "./gallery.json";
import { CLUB, type Contributor, type TeamMember } from "./config";
import type { Photo } from "@/components/site/PhotoGrid";
import type { StickerName } from "@/components/ui/Sticker";

/* The Memories page: the club's story, one chapter per club year, oldest first.
   Words (titles, stories, moments, quotes) come from content/memories.json (the editor: Memories).
   Photos come from the gallery pipeline (scripts/photos.mjs): each moment names a folder.
   Who led each year is never typed twice: it's read from the team's "Before" lines ("Former President, 2024-25")
   and, for this year, from the current team. */

export interface Person { name: string; handle: string; photo?: string; githubAvatar?: boolean }
export interface Leader extends Person { role: string }
export interface Moment { title: string; date?: string; caption?: string; folder?: string; photos: Photo[] }
export interface Quote { text: string; name: string; role?: string }
export interface Chapter { year: string; title?: string; story?: string; started: boolean; leaders: Leader[]; moments: Moment[]; quotes: Quote[] }
export interface Memories { chapters: Chapter[]; cover?: Photo; photos: number; sample?: boolean }

type RawMoment = { title?: string | null; date?: string | null; caption?: string | null; folder?: string | null };
type RawQuote = { text?: string | null; name?: string | null; role?: string | null };
type RawChapter = { year?: string | null; title?: string | null; story?: string | null; started?: boolean | null; moments?: RawMoment[] | null; quotes?: RawQuote[] | null };
export type RawWords = { intro?: string | null; thanks?: string | null; missing?: string | null; nextTitle?: string | null; nextText?: string | null };
export type RawMemories = { cover?: { folder?: string | null; photo?: number | null } | null; chapters?: RawChapter[] | null; words?: RawWords | null };

/** "", null and missing all mean "not set". */
const opt = (s?: string | null) => s?.trim() || undefined;
const PAST = /^(?:former\s+)?(.+?),\s*(\d{4}-\d{2})$/i;

/** Who led a club year: everyone whose "Before" line names that year, and for the current year the leads, then the mentors. */
export function leadersFor(year: string, team: TeamMember[] = CLUB.team, current = CLUB.year): Leader[] {
  const face = (m: TeamMember, role: string): Leader => ({ name: m.name, handle: m.handle, photo: m.photo, githubAvatar: m.githubAvatar, role });
  const past = team.flatMap((m) => { const x = m.past?.match(PAST); return x && x[2] === year ? [face(m, x[1])] : []; });
  if (year !== current) return past;
  return [...team.filter((m) => m.group === "lead").map((m) => face(m, m.role ?? "Lead")), ...team.filter((m) => m.group === "mentor").map((m) => face(m, "Mentor")), ...past];
}

export function loadMemories(raw: RawMemories = data as RawMemories, photos: Photo[] = gallery as Photo[], team: TeamMember[] = CLUB.team, current = CLUB.year): Memories {
  const inFolder = (f?: string) => (f ? photos.filter((p) => p.event === f) : []);
  const chapters: Chapter[] = (raw.chapters ?? []).filter((c) => opt(c.year)).map((c) => ({
    year: opt(c.year)!, title: opt(c.title), story: opt(c.story), started: !!c.started, leaders: leadersFor(opt(c.year)!, team, current),
    moments: (c.moments ?? []).filter((m) => opt(m.title)).map((m) => ({ title: opt(m.title)!, date: opt(m.date), caption: opt(m.caption), folder: opt(m.folder), photos: inFolder(opt(m.folder)) })),
    quotes: (c.quotes ?? []).filter((q) => opt(q.text) && opt(q.name)).map((q) => ({ text: opt(q.text)!, name: opt(q.name)!, role: opt(q.role) })),
  })).sort((a, b) => a.year.localeCompare(b.year));
  const all = chapters.flatMap((c) => c.moments.flatMap((m) => m.photos));
  // the opening photo: the one picked in the editor, else the first photo of the newest year that has any
  const picked = inFolder(opt(raw.cover?.folder)), n = raw.cover?.photo ?? 1;
  const cover = picked.find((p) => p.index === n) ?? picked[0] ?? [...chapters].reverse().flatMap((c) => c.moments.flatMap((m) => m.photos))[0];
  return { chapters, cover, photos: new Set(all.map((p) => p.id)).size };
}

/** Everyone to thank, once each, A to Z (so it never reads as a ranking): the team and the contributors list. */
export function thanks(team: Person[] = CLUB.team, contributors: Contributor[] = CLUB.contributors): string[] {
  const seen = new Map<string, string>();
  for (const p of [...team, ...contributors]) { const k = p.name.trim().toLowerCase(); if (k && !seen.has(k)) seen.set(k, p.name.trim()); }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

/** The page's own words (editor: Memories, Page words). A cleared box falls back to these, so the page never shows a blank. */
const WORDS_DEFAULT: Record<keyof RawWords, string> = {
  intro: "Every year of the club, kept in one place: the people who led it, the sessions, and the small moments in between. Oldest first, the way it happened.",
  thanks: "To everyone who has led, mentored, organised or pitched in. None of this happens without you.",
  missing: "Missing someone? Tell a lead, and they'll add them to the team or the contributors list.",
  nextTitle: "Your story starts here.",
  nextText: "The next chapter is written by whoever shows up. Come to a session, make your first pull request, and you're part of it.",
};
export const loadWords = (raw: RawWords | null | undefined = (data as RawMemories).words) =>
  Object.fromEntries(Object.entries(WORDS_DEFAULT).map(([k, d]) => [k, opt(raw?.[k as keyof RawWords]) ?? d])) as Record<keyof RawWords, string>;

export const MEMORIES = loadMemories();
export const WORDS = loadWords();
/** The page is linked (header search, footer, sitemap) only once real photos exist. Until then it's there, but quiet. */
export const MEMORIES_LINKED = MEMORIES.photos > 0;

/* Preview deployments fill the page with a clearly labelled sample (Octodex stickers on coloured tiles, never people, and placeholder words)
   so the design can be judged before the photos arrive. Real years and real leaders stay real. Never on the live site. Locally: MEMORIES_SAMPLE=1. */
export const SHOW_SAMPLE = process.env.VERCEL_ENV === "preview" || process.env.MEMORIES_SAMPLE === "1";

const TONES = ["#b9e0f7", "#d9c8f7", "#bfeedd", "#ffe7a3", "#f8d3c5", "#d5dedb"];
const STICKERS: StickerName[] = ["welcome", "coder", "mentor", "heart", "jetpack", "professor", "maker", "film", "adventure", "support", "swag", "pop", "world", "skate", "cherry", "agenda"];
const SHAPES: [number, number][] = [[1800, 1200], [1200, 1500], [1800, 1350], [1400, 1400], [1200, 1600], [1800, 1200], [1500, 1200]];
const MOMENTS = [
  ["First session of the year", "A caption the club writes later: who was there, what happened, the small thing everyone remembers."],
  ["The night before the event", "Sample caption. Real captions come from the folder's captions.json or from the editor."],
  ["Everyone, one photo", "Sample caption for a group photo."],
  ["Wrapping up", "Sample caption."],
];

export function sampleMemories(real: Memories = MEMORIES): Memories {
  let k = 0;
  const photo = (y: number, m: number, i: number): Photo => {
    const [w, h] = SHAPES[(y * 3 + m * 2 + i) % SHAPES.length];
    return { id: `sample-${y}-${m}-${i}`, event: "sample", eventTitle: "Sample", index: i + 1, w, h, alt: "Sample placeholder: an Octodex sticker on a coloured tile", caption: "Sample photo. Real photos go here.", sample: { tone: TONES[k % TONES.length], sticker: STICKERS[k++ % STICKERS.length] } };
  };
  const chapters = real.chapters.map((c, y) => ({
    ...c,
    title: c.title ?? "Sample chapter title",
    story: c.story ?? "Sample story. Two or three short paragraphs about this year go here, written later by someone who was there: what it felt like, who showed up, what changed.\n\nThe club adds the real words in the content editor (Memories). Until then the live site shows only the year and the people who led it.",
    moments: c.moments.some((m) => m.photos.length) ? c.moments : MOMENTS.slice(0, y === real.chapters.length - 1 ? 4 : 3).map(([title, caption], m) => ({ title: `Sample: ${title.toLowerCase()}`, caption, date: `${c.year.slice(0, 4)}-${["08", "09", "11", "12"][m]}-1${m}`, photos: Array.from({ length: [5, 2, 3, 1][m] }, (_, i) => photo(y, m, i)) })),
    quotes: c.quotes.length ? c.quotes : [{ text: "Sample quote. A line from a member, in their own words, added by the club with their permission.", name: "A member", role: "Sample" }],
  }));
  const all = chapters.flatMap((c) => c.moments.flatMap((m) => m.photos));
  return { chapters, cover: real.cover ?? all[0], photos: all.length, sample: true };
}
