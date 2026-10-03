/* Turns raw photos into a fast gallery. The home page Gallery, event recaps and the Memories page all read from it.

   1. Put photos in folders, one per event or moment:   photos-inbox/<folder-name>/IMG_001.jpg ...
      (folder names like "git-101-sept-2024" are fine; they become the gallery's event filter, and the folder you pick in the editor)
      Optional captions:                 photos-inbox/<folder-name>/captions.json   {"IMG_001.jpg": "Mentors helping with the first pull request"}
   2. Run:   node scripts/photos.mjs
   3. Commit public/gallery and lib/gallery.json. The raw photos in photos-inbox are never committed.

   Only the folders in photos-inbox are (re)made, each as a whole; photos already in the gallery from other folders are kept.
   So you only need this time's photos on your computer. To rebuild everything from scratch: node scripts/photos.mjs --fresh

   For every photo this: fixes rotation, REMOVES hidden camera/location data (EXIF), makes 3 WebP sizes,
   and records the size so the page never jumps while loading. */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { folders, mergeManifest, slug, title } from "./photos-lib.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--")), fresh = process.argv.includes("--fresh");
const [INBOX, OUT, MANIFEST] = [args[0] ?? "photos-inbox", args[1] ?? "public/gallery", args[2] ?? "lib/gallery.json"];
const SIZES = [{ w: 480, s: "sm" }, { w: 960, s: "md" }, { w: 1800, s: "lg" }];
const EXT = /\.(jpe?g|png|webp|heic|heif|avif|tiff?)$/i;

if (!fs.existsSync(INBOX)) { console.error(`No ${INBOX}/ folder. Create it and add photos in event folders.`); process.exit(1); }
const old = !fresh && fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : [];
const photos = [], processed = [];
for (const dir of fs.readdirSync(INBOX, { withFileTypes: true }).filter((d) => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const event = slug(dir.name);
  const capFile = path.join(INBOX, dir.name, "captions.json");
  const captions = fs.existsSync(capFile) ? JSON.parse(fs.readFileSync(capFile, "utf8")) : {};
  const files = fs.readdirSync(path.join(INBOX, dir.name)).filter((f) => EXT.test(f)).sort();
  if (!files.length) continue;
  const before = old.filter((p) => p.event === event).length;
  if (before > files.length) console.warn(`! ${event}: had ${before} photos, now ${files.length}. A folder is replaced as a whole; put all its photos back to keep them.`);
  fs.rmSync(path.join(OUT, event), { recursive: true, force: true }); // no leftover sizes from a bigger earlier run
  fs.mkdirSync(path.join(OUT, event), { recursive: true });
  for (const [i, f] of files.entries()) {
    const id = `${event}-${String(i + 1).padStart(2, "0")}`;
    const input = sharp(path.join(INBOX, dir.name, f), { failOn: "none" }).rotate(); // .rotate() applies EXIF orientation; output has no metadata
    for (const { w, s } of SIZES) await input.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(OUT, event, `${i + 1}-${s}.webp`));
    const outMeta = await sharp(path.join(OUT, event, `${i + 1}-lg.webp`)).metadata();
    photos.push({ id, event, eventTitle: title(dir.name), index: i + 1, w: outMeta.width, h: outMeta.height, alt: captions[f] ?? `${title(dir.name)} — photo ${i + 1}`, caption: captions[f] ?? "" });
  }
  processed.push(event);
}
const all = mergeManifest(old, photos, processed);
fs.writeFileSync(MANIFEST, JSON.stringify(all, null, 2) + "\n");
console.log(`${photos.length} photos from ${processed.length} folder${processed.length === 1 ? "" : "s"} → ${OUT}, ${MANIFEST} (${all.length} photos in the gallery)`);
console.log("\nFolders you can pick in the content editor (Memories → a moment → Photo folder):");
for (const f of folders(all)) console.log(`  ${f.folder}  (${f.photos} photo${f.photos === 1 ? "" : "s"})`);
