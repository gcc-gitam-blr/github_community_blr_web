/* Event recaps: video links people paste, and which gallery photos belong to which event. */
import { recapPhotos, youtubeId } from "../lib/recap";
import { EVENTS, eventSlug, lastEvent, type ClubEvent } from "../lib/events";
import type { Photo } from "../components/site/PhotoGrid";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const ID = "dQw4w9WgXcQ";
for (const url of [`https://www.youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}?si=abc`, `https://m.youtube.com/watch?v=${ID}&t=42`, `https://www.youtube.com/shorts/${ID}`, `https://www.youtube.com/live/${ID}?feature=share`, `https://www.youtube-nocookie.com/embed/${ID}`])
  ok(`reads the video id from ${url}`, youtubeId(url) === ID);
ok("an Instagram reel isn't a YouTube video (it shows as a link instead)", youtubeId("https://www.instagram.com/reel/C1x2y3z4/") === null);
ok("a YouTube channel page isn't a video", youtubeId("https://www.youtube.com/@github") === null);
ok("a malformed id is refused", youtubeId("https://youtu.be/not-an-id") === null && youtubeId("https://www.youtube.com/watch?v=<script>") === null);
ok("text that isn't a link is refused", youtubeId("youtube video") === null);

const e = EVENTS[0];
const photo = (event: string, index: number): Photo => ({ id: `${event}-${index}`, event, eventTitle: event, index, w: 960, h: 640, alt: "", caption: "" });
const all = [photo(eventSlug(e), 1), photo("some-other-event", 1), photo("first-session", 1), photo("first-session", 2)];
ok("photos match the event's slug by default", recapPhotos(e, { text: "" }, all).length === 1);
ok("`photos` picks a differently named folder", recapPhotos(e, { text: "", photos: "first-session" }, all).length === 2);
ok("no photos is fine", recapPhotos(e, { text: "" }, []).length === 0);

// "Last" in the hero: the newest past event with something written about it
const ev = (date: string, recap?: ClubEvent["recap"], dateLabel?: string) => ({ ...EVENTS[0], date, recap, dateLabel }) as ClubEvent;
const cal = [ev("2026-10-12", { text: "It went well", numbers: [], materials: [] }), ev("2026-10-28", { text: "", numbers: [], materials: [] }), ev("2026-12-01", { text: "Big", numbers: [], materials: [] }, "December")];
ok("'last' is the newest past event with a recap", lastEvent("2026-11-01", cal)?.date === "2026-10-12");
ok("…an event without a recap yet is skipped", lastEvent("2026-10-29", cal)?.date === "2026-10-12");
ok("…a recap written on the day still waits for the day to pass", lastEvent("2026-10-12", cal) === null);
ok("…a month-long event with no fixed date is never 'last'", lastEvent("2027-01-05", cal)?.date === "2026-10-12");
ok("…a number alone counts as a recap", lastEvent("2026-11-01", [ev("2026-10-28", { text: "", numbers: [{ value: 40, label: "Attendees" }], materials: [] })])?.date === "2026-10-28");

if (fails) { console.log(`${fails} recap check(s) failed`); process.exit(1); }
console.log("all recap checks passed");
