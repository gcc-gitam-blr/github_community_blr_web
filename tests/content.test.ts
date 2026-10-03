/* The content files (content/club, content/epoch) that the editor saves: every entry is complete,
   and "not set" (empty text, empty lists, an empty recap) reads as missing, never as an empty value on the page. */
import { CLUB } from "../lib/config";
import { EPOCH, SCHEDULE, SPONSORS } from "../lib/epoch/config";
import { eventSlug } from "../lib/events";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const filled = (s: unknown) => typeof s === "string" && s.trim().length > 0;
const SHAPES = ["diamond", "square", "ring", "triangle"], COLORS = ["blue", "purple", "mint", "green"];

ok("club settings are filled in", [CLUB.name, CLUB.university, CLUB.year].every(filled));
ok("every event has a real date, title, type, description and place", CLUB.events.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && [e.title, e.type, e.text, e.where].every(filled)));
ok("every event has a timeline shape and colour", CLUB.events.every((e) => SHAPES.includes(e.shape) && COLORS.includes(e.color)));
ok("event pages get unique addresses", new Set(CLUB.events.map(eventSlug)).size === CLUB.events.length);
ok("an empty recap reads as no recap", CLUB.events.every((e) => !e.recap || filled(e.recap.text)));
ok("unset event fields are missing, not empty", CLUB.events.every((e) => e.dateLabel !== "" && e.luma !== "" && e.href !== ""));
ok("Epoch keeps its own section link", CLUB.events.some((e) => e.href === "/epoch"));

ok("everyone on the team has a name and a row", CLUB.team.every((m) => filled(m.name) && ["mentor", "lead", "member"].includes(m.group)));
ok("crew levels are numbers 1–3", CLUB.team.every((m) => (m.crew ?? []).every((c) => [1, 2, 3].includes(c.level))));
ok("handles are text (empty when unknown) and never start with @", [...CLUB.team, ...CLUB.contributors].every((p) => typeof p.handle === "string" && !p.handle.startsWith("@")));
ok("photos are site paths", [...CLUB.team, ...CLUB.contributors].every((p) => !p.photo || p.photo.startsWith("/")));
ok("unset team fields are missing, not empty", CLUB.team.every((m) => m.role !== "" && m.past !== "" && m.tags?.length !== 0 && m.crew?.length !== 0));
ok("every contributor has a name", CLUB.contributors.every((c) => filled(c.name)));
ok("every FAQ has a question and an answer", CLUB.faq.every((f) => filled(f.q) && filled(f.a)));
ok("announcements have an id and text", CLUB.announcements.every((a) => filled(a.id) && filled(a.text)));
ok("social links are https", CLUB.socials.every((s) => s.href.startsWith("https://")));

ok("Epoch's open and close times are valid dates", !isNaN(Date.parse(EPOCH.opensAt)) && !isNaN(Date.parse(EPOCH.closesAt)) && Date.parse(EPOCH.opensAt) < Date.parse(EPOCH.closesAt));
ok("Epoch's start is empty or a valid date", EPOCH.startsAt === "" || !isNaN(Date.parse(EPOCH.startsAt)));
ok("the ticket price is a positive number or not set", EPOCH.ticketPriceINR === null || EPOCH.ticketPriceINR > 0);
ok("the schedule has days 1 and 2, each with sessions", SCHEDULE.map((d) => d.day).join() === "1,2" && SCHEDULE.every((d) => d.items.length > 0));
ok("every session has a 24-hour start time", SCHEDULE.every((d) => d.items.every((i) => /^\d{2}:\d{2}$/.test(i.time) && (!i.end || /^\d{2}:\d{2}$/.test(i.end)))));
ok("sponsors have a name and a link", SPONSORS.every((s) => filled(s.name) && s.url.startsWith("http")));
if (fails) { console.log(`${fails} content check(s) failed`); process.exit(1); }
console.log("all content checks passed");
