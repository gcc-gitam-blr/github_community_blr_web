/* GitHub's animated 3D stickers → small animated WebP for the site (components/ui/LiveSticker.tsx).
   Put the original GIFs in photos-inbox/stickers/ (never committed), then:  node scripts/live-stickers.mjs
   The GIFs were cut out against green, so every frame has a 1–2px green rim; that's removed first.
   Writes public/stickers/<name>.webp (animated) and <name>-still.webp (first frame, for reduced motion). */
import sharp from "sharp";
import fs from "node:fs";

const JOBS = [["Cat 3D Sticker by GitHub.gif", "cat-3d", 200], ["Rubber Duck 3D Sticker by GitHub.gif", "duck-3d", 180]];
const greenish = (d, i) => d[i + 1] > d[i] + 15 && d[i + 1] > d[i + 2] + 15;

/** Clear green pixels that touch transparency, a few passes deep (the rim), leaving green inside the art alone. */
function cleanFrame(d, w, h) {
  for (let pass = 0; pass < 6; pass++) {
    const clear = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!d[i + 3] || !greenish(d, i)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx < 0 || ny < 0 || nx >= w || ny >= h || !d[(ny * w + nx) * 4 + 3]; });
      if (edge) clear.push(i);
    }
    if (!clear.length) break;
    for (const i of clear) d[i + 3] = 0;
  }
}

for (const [src, out, px] of JOBS) {
  const file = `photos-inbox/stickers/${src}`;
  if (!fs.existsSync(file)) { console.log(`skip ${out}: ${file} not found`); continue; }
  const meta = await sharp(file, { animated: true }).metadata();
  const frames = [];
  for (let p = 0; p < meta.pages; p++) {
    const { data, info } = await sharp(file, { page: p }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    cleanFrame(data, info.width, info.height);
    frames.push(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(px, px).png().toBuffer());
  }
  await sharp(frames, { join: { animated: true } }).webp({ quality: 55, effort: 4, loop: 0, delay: meta.delay ?? 70 }).toFile(`public/stickers/${out}.webp`);
  await sharp(frames[0]).webp({ quality: 80 }).toFile(`public/stickers/${out}-still.webp`);
  console.log(`${out}: ${meta.pages} frames, ${(fs.statSync(`public/stickers/${out}.webp`).size / 1024) | 0} KB`);
}
