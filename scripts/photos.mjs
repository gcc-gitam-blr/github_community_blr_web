/* Turns raw event photos into a fast gallery.

   1. Put photos in folders by event:   photos-inbox/<event-name>/IMG_001.jpg ...
      (folder names like "git-101-sept-2024" are fine; they become the gallery's event filter)
      Optional captions:                 photos-inbox/<event-name>/captions.json   {"IMG_001.jpg": "Mentors helping with the first pull request"}
   2. Run:   node scripts/photos.mjs
   3. Commit public/gallery and lib/gallery.json. The raw photos in photos-inbox are never committed.

   For every photo this: fixes rotation, REMOVES hidden camera/location data (EXIF), makes 3 WebP sizes,
   and records the size so the page never jumps while loading. */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const [INBOX, OUT, MANIFEST] = [process.argv[2] ?? "photos-inbox", process.argv[3] ?? "public/gallery", process.argv[4] ?? "lib/gallery.json"];
const SIZES = [{ w: 480, s: "sm" }, { w: 960, s: "md" }, { w: 1800, s: "lg" }];
const EXT = /\.(jpe?g|png|webp|heic|heif|avif|tiff?)$/i;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const title = (s) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

if (!fs.existsSync(INBOX)) { console.error(`No ${INBOX}/ folder. Create it and add photos in event folders.`); process.exit(1); }
const photos = [];
let n = 0;
for (const dir of fs.readdirSync(INBOX, { withFileTypes: true }).filter((d) => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const event = slug(dir.name);
  const capFile = path.join(INBOX, dir.name, "captions.json");
  const captions = fs.existsSync(capFile) ? JSON.parse(fs.readFileSync(capFile, "utf8")) : {};
  const files = fs.readdirSync(path.join(INBOX, dir.name)).filter((f) => EXT.test(f)).sort();
  fs.mkdirSync(path.join(OUT, event), { recursive: true });
  for (const [i, f] of files.entries()) {
    const id = `${event}-${String(i + 1).padStart(2, "0")}`;
    const input = sharp(path.join(INBOX, dir.name, f), { failOn: "none" }).rotate(); // .rotate() applies EXIF orientation; output has no metadata
    const meta = await input.clone().metadata();
    for (const { w, s } of SIZES) await input.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(OUT, event, `${i + 1}-${s}.webp`));
    const outMeta = await sharp(path.join(OUT, event, `${i + 1}-lg.webp`)).metadata();
    photos.push({ id, event, eventTitle: title(dir.name), index: i + 1, w: outMeta.width, h: outMeta.height, alt: captions[f] ?? `${title(dir.name)} — photo ${i + 1}`, caption: captions[f] ?? "" });
    n++;
  }
}
fs.writeFileSync(MANIFEST, JSON.stringify(photos, null, 2) + "\n");
console.log(`${n} photos from ${new Set(photos.map((p) => p.event)).size} events → ${OUT}, ${MANIFEST}`);
