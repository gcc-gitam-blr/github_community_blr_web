/* The session materials archive on /learn: which sessions show, in what order, and with which links. */
import { sessionMaterials } from "../lib/materials";
import type { ClubEventData } from "../lib/config";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const ev = (date: string, recap?: ClubEventData["recap"]): ClubEventData => ({ date, title: `Session ${date}`, type: "Workshop", text: "", where: "GITAM", shape: "diamond", color: "blue", recap });

const list = sessionMaterials([
  ev("2026-10-07", { text: "It was great", slides: "https://s/1", video: "https://youtu.be/dQw4w9WgXcQ", materials: [{ title: "Starter repo", url: "https://github.com/x/y", kind: "code" }] }),
  ev("2026-10-12", { text: "Only a story" }),
  ev("2027-01-04"),
  ev("2026-11-02", { text: "", materials: [{ title: "Slides", url: "https://s/2", kind: "slides" }] }),
  ev("2026-12-01", { text: "dup", slides: "https://s/3", materials: [{ title: "Same slides", url: "https://s/3", kind: "slides" }] }),
]);
ok("sessions with nothing to share don't show", list.length === 3 && !list.some((s) => s.event.date === "2026-10-12" || s.event.date === "2027-01-04"));
ok("newest first", list.map((s) => s.event.date).join() === "2026-12-01,2026-11-02,2026-10-07");
const first = list.find((s) => s.event.date === "2026-10-07")!;
ok("slides, then the recording, then extra links", first.items.map((i) => i.kind).join() === "slides,recording,code");
ok("links work without a written recap", list.some((s) => s.event.date === "2026-11-02"));
ok("the same link added twice shows once", list.find((s) => s.event.date === "2026-12-01")!.items.length === 1);
ok("no events, no archive", sessionMaterials([]).length === 0);
if (fails) { console.log(`${fails} materials check(s) failed`); process.exit(1); }
console.log("all materials checks passed");
