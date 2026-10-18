/* The organisers' one-key jumps: where each key goes, and every case where a key press must be left alone. */
import { shortcutFor } from "../lib/shortcuts";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const body = { tagName: "BODY" };

ok("A opens the club admin, E the Epoch desk", shortcutFor({ key: "a", target: body }, "/") === "/admin" && shortcutFor({ key: "e", target: body }, "/learn") === "/epoch/admin");
ok("capital letters work too (caps lock or shift)", shortcutFor({ key: "A", target: body }, "/") === "/admin");
ok("other keys do nothing", shortcutFor({ key: "b", target: body }, "/") === null && shortcutFor({ key: "Enter", target: body }, "/") === null);
ok("never while typing in a field", ["INPUT", "TEXTAREA", "SELECT"].every((t) => shortcutFor({ key: "a", target: { tagName: t } }, "/") === null) && shortcutFor({ key: "a", target: { tagName: "DIV", isContentEditable: true } }, "/") === null);
ok("never with Ctrl, Cmd or Alt (those belong to the browser)", shortcutFor({ key: "a", ctrlKey: true, target: body }, "/") === null && shortcutFor({ key: "a", metaKey: true, target: body }, "/") === null && shortcutFor({ key: "e", altKey: true, target: body }, "/") === null);
ok("not when held down, or when the page already used the key", shortcutFor({ key: "a", repeat: true, target: body }, "/") === null && shortcutFor({ key: "a", defaultPrevented: true, target: body }, "/") === null);
ok("not in the content editor or on public kiosk screens", shortcutFor({ key: "a", target: body }, "/keystatic/singleton/settings") === null && shortcutFor({ key: "e", target: body }, "/epoch/kiosk/vr") === null && shortcutFor({ key: "a", target: body }, "/epoch/screen") === null);
ok("not to the page you're already on", shortcutFor({ key: "a", target: body }, "/admin") === null && shortcutFor({ key: "e", target: body }, "/epoch/admin") === null);

console.log(fails ? `\n${fails} FAILED` : "\nall shortcut checks passed"); process.exit(fails ? 1 : 0);
