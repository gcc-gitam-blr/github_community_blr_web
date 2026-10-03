/* The photo pipeline (scripts/photos.mjs): re-running it with only new photos never wipes the gallery. */
import { folders, mergeManifest, slug, title } from "../scripts/photos-lib.mjs";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const p = (event: string, index: number) => ({ id: `${event}-0${index}`, event, eventTitle: title(event), index, w: 1800, h: 1200, alt: "", caption: "" });

ok("folder names become web-safe", slug("First Session, Oct 2024!") === "first-session-oct-2024" && slug("--Team Day--") === "team-day");
ok("folder names become titles", title("git-101_sept-2024") === "Git 101 Sept 2024");

const old = [p("first-session", 1), p("first-session", 2), p("team-day", 1), p("team-day", 2), p("team-day", 3)];
const merged = mergeManifest(old, [p("team-day", 1), p("epoch-2025", 1)], ["team-day", "epoch-2025"]);
ok("folders not in the inbox keep their photos", merged.filter((x) => x.event === "first-session").length === 2);
ok("a folder in the inbox is replaced as a whole", merged.filter((x) => x.event === "team-day").length === 1);
ok("new folders are added", merged.some((x) => x.event === "epoch-2025"));
ok("the manifest is sorted by folder, then photo", merged.map((x) => x.id).join() === "epoch-2025-01,first-session-01,first-session-02,team-day-01");
ok("--fresh (no old manifest) keeps only this run", mergeManifest([], [p("a", 1)], ["a"]).length === 1);
ok("the editor's folder list counts photos per folder", JSON.stringify(folders(old)) === JSON.stringify([{ folder: "first-session", title: "First Session", photos: 2 }, { folder: "team-day", title: "Team Day", photos: 3 }]));

if (fails) { console.log(`${fails} photo check(s) failed`); process.exit(1); }
console.log("all photo checks passed");
