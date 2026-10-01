/* Which announcement shows today: date windows, newest wins, none when empty. */
import { CLUB } from "../lib/config";
import { activeAnnouncement } from "../components/site/Announcement";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
CLUB.announcements.length = 0;
ok("nothing configured → nothing shown", activeAnnouncement("2026-10-07") === undefined);
CLUB.announcements.push({ id: "a", text: "A", from: "2026-10-01", until: "2026-10-10" }, { id: "b", text: "B", from: "2026-10-05", until: "2026-10-08" }, { id: "c", text: "C" });
ok("before a window opens, it's not shown", activeAnnouncement("2026-09-30")?.id === "c");
ok("the newest active announcement wins", activeAnnouncement("2026-10-06")?.id === "c");
CLUB.announcements.pop();
ok("while two overlap, the later-listed one wins", activeAnnouncement("2026-10-06")?.id === "b");
ok("the window is inclusive of its last day", activeAnnouncement("2026-10-10")?.id === "a");
ok("after the window it disappears", activeAnnouncement("2026-10-11") === undefined);
console.log(fails ? `\n${fails} FAILED` : "\nall announcement checks passed"); process.exit(fails ? 1 : 0);
