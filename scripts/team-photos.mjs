/* Team photos: square, face-centred, small and clean.

   1. Put photos in photos-inbox/team/ (never committed), named after the person, e.g. "Monisha S.png".
   2. Run:   node scripts/team-photos.mjs
   3. Commit public/team/*.webp, then set `photo: "/team/<name>.webp"` on the person in lib/config.ts.

   Each photo is rotated upright, cropped to a square around the face (positions in scripts/team-photos.json;
   without one, sharp picks the most interesting region), resized to 480px and 240px WebP, and stripped of
   hidden camera/location data. */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const IN = "photos-inbox/team", OUT = "public/team";
const crops = JSON.parse(fs.readFileSync("scripts/team-photos.json", "utf8"));
const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(IN).filter((f) => /\.(jpe?g|png|webp|heic|avif)$/i.test(f))) {
  const id = slug(f), img = sharp(path.join(IN, f)).rotate();
  const { width: w, height: h } = await sharp(await img.clone().toBuffer()).metadata();
  const c = crops[id];
  let base = img.clone();
  if (c) {
    const side = Math.round(Math.min(w, h, c.size * w));
    const left = Math.max(0, Math.min(w - side, Math.round(c.x * w - side / 2)));
    const top = Math.max(0, Math.min(h - side, Math.round(c.y * h - side * 0.38))); // face a little above centre
    base = base.extract({ left, top, width: side, height: side });
  } else base = base.resize(Math.min(w, h), Math.min(w, h), { fit: "cover", position: sharp.strategy.attention });
  const square = await base.toBuffer(); // sharp drops metadata (EXIF/GPS) unless asked to keep it
  for (const [px, suffix] of [[480, ""], [240, "-sm"]]) await sharp(square).resize(px, px).webp({ quality: 80 }).toFile(path.join(OUT, `${id}${suffix}.webp`));
  console.log(`${f} → ${OUT}/${id}.webp${c ? "" : "  (no crop set — used automatic; add it to scripts/team-photos.json)"}`);
}
