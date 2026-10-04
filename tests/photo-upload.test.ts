/* Photo uploads: folder names, the WebP check, and adding to the gallery manifest without overwriting anything. */
import { addToManifest, folderOk, isWebp, toFolder } from "../lib/photo-upload";
import type { Photo } from "../components/site/PhotoGrid";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
ok("event titles become folder names", toFolder("Learn GitHub & Make Your First Contribution") === "learn-github-and-make-your-first-contribution");
ok("only lowercase words joined by dashes are folders", folderOk("git-merge-26") && !folderOk("../etc") && !folderOk("Has Spaces") && !folderOk("") && !folderOk("a--b"));
const webp = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 1]), png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0]);
ok("only real WebP files are accepted", isWebp(webp) && !isWebp(png) && !isWebp(new Uint8Array(3)));
const existing: Photo[] = [{ id: "a-01", event: "a", eventTitle: "A", index: 1, w: 1, h: 1, alt: "", caption: "" }, { id: "a-03", event: "a", eventTitle: "A", index: 3, w: 1, h: 1, alt: "", caption: "" }, { id: "b-01", event: "b", eventTitle: "B", index: 1, w: 1, h: 1, alt: "", caption: "" }];
const { manifest, added } = addToManifest(existing, "a", "A", [{ w: 960, h: 640, caption: "  First PR!  " }, { w: 640, h: 960 }]);
ok("new photos are numbered after the folder's highest, so nothing is overwritten", added.map((p) => p.index).join() === "4,5" && added[0].id === "a-04");
ok("everything already there stays", manifest.length === 5 && manifest.slice(0, 3).every((p, i) => p === existing[i]));
ok("captions are trimmed and become the alt text; no caption gets a sensible one", added[0].caption === "First PR!" && added[0].alt === "First PR!" && added[1].alt === "A — photo 5");
ok("a new folder starts at 1", addToManifest(existing, "new", "New", [{ w: 1, h: 1 }]).added[0].index === 1);
if (fails) { console.log(`${fails} photo-upload check(s) failed`); process.exit(1); }
console.log("all photo-upload checks passed");
