/* The Memories page: chapters from the editor, leaders from the team's real "Before" lines, photos from the gallery. */
import { leadersFor, loadMemories, loadWords, sampleMemories, thanks, type RawMemories } from "../lib/memories";
import type { TeamMember } from "../lib/config";
import type { Photo } from "../components/site/Lightbox";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

const team = [
  { name: "Asha", handle: "asha", group: "mentor", role: "Mentor", past: "Former President, 2024-25" },
  { name: "Ravi", handle: "ravi", group: "mentor", role: "Mentor", past: "Former Vice-President, 2025-26" },
  { name: "Meera", handle: "meera", group: "lead", role: "President" },
  { name: "Kiran", handle: "kiran", group: "core", role: "Design" },
  { name: "Old Head", handle: "", group: "mentor", role: "Mentor", past: "Former Events Head" }, // no year: never guessed
] as unknown as TeamMember[];

ok("a past year's leaders come only from Before lines naming that year", leadersFor("2024-25", team, "2026-27").map((l) => `${l.name}:${l.role}`).join() === "Asha:President");
ok("'Former' is dropped from the role", leadersFor("2025-26", team, "2026-27")[0].role === "Vice-President");
ok("a year nobody is listed for has no leaders (none invented)", leadersFor("2023-24", team, "2026-27").length === 0);
ok("this year: leads first, then mentors", leadersFor("2026-27", team, "2026-27").map((l) => l.name).join() === "Meera,Asha,Ravi,Old Head");

const photo = (event: string, index: number): Photo => ({ id: `${event}-${index}`, event, eventTitle: event, index, w: 1800, h: 1200, alt: "", caption: "" });
const gallery = [photo("first-session", 1), photo("first-session", 2), photo("epoch-25", 1)];
const raw: RawMemories = {
  cover: { folder: "", photo: null },
  chapters: [
    { year: "2025-26", title: "", story: "  ", moments: [{ title: "Epoch", date: "", caption: null, folder: "epoch-25" }], quotes: [{ text: "", name: "X" }] },
    { year: "2024-25", title: "Day one", started: true, moments: [{ title: "First session", folder: "first-session" }, { title: "", folder: "first-session" }, { title: "No photos yet", folder: "" }], quotes: [] },
    { year: "", moments: [] },
  ],
};
const m = loadMemories(raw, gallery, team, "2026-27");
ok("chapters are oldest first; a chapter without a year is skipped", m.chapters.map((c) => c.year).join() === "2024-25,2025-26");
ok("empty text means not set", m.chapters[1].title === undefined && m.chapters[1].story === undefined && m.chapters[1].moments[0].date === undefined);
ok("a moment without a title is skipped", m.chapters[0].moments.length === 2);
ok("a moment's photos are its folder's photos", m.chapters[0].moments[0].photos.length === 2 && m.chapters[0].moments[1].photos.length === 0);
ok("a quote needs both words and a name", m.chapters[1].quotes.length === 0);
ok("photos are counted once each", m.photos === 3);
ok("no cover picked → the first photo of the newest year with photos", m.cover?.id === "epoch-25-1");
ok("a picked cover wins", loadMemories({ ...raw, cover: { folder: "first-session", photo: 2 } }, gallery, team, "2026-27").cover?.id === "first-session-2");
ok("no photos anywhere → no cover and nothing to link", loadMemories(raw, [], team, "2026-27").photos === 0 && !loadMemories(raw, [], team, "2026-27").cover);
ok("empty file → no chapters", loadMemories({}, gallery, team).chapters.length === 0);

const s = sampleMemories(loadMemories(raw, [], team, "2026-27"));
ok("the sample is marked as a sample", s.sample === true && s.photos > 0);
ok("sample photos are stickers on tiles, never real photos", s.chapters.every((c) => c.moments.every((mo) => mo.photos.every((p) => p.sample && p.event === "sample"))));
ok("the sample keeps the real years and the real leaders", s.chapters.map((c) => c.year).join() === "2024-25,2025-26" && s.chapters[0].leaders[0].name === "Asha");
ok("the sample keeps real words where the club wrote them", s.chapters[0].title === "Day one");

const names = thanks([{ name: "ravi", handle: "" }, { name: "Asha", handle: "" }], [{ name: "Ravi ", handle: "r" }, { name: "Bhavya", handle: "b" }] as never);
ok("the thank-you wall lists everyone once, A to Z", names.join() === "Asha,Bhavya,ravi");

const w = loadWords({ intro: "  Our years.  ", thanks: "", missing: null });
ok("the page's words come from the editor", w.intro === "Our years.");
ok("a cleared box puts the original words back, never a blank", w.thanks.length > 0 && w.missing.startsWith("Missing someone?") && loadWords(null).nextTitle === "Your story starts here.");
ok("the saved page words load as they are in the file", loadWords().nextTitle === "Your story starts here." && loadWords().intro.startsWith("Every year of the club"));

if (fails) { console.log(`${fails} memories check(s) failed`); process.exit(1); }
console.log("all memories checks passed");
