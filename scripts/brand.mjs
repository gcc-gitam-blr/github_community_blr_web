/* The club's logo, in the sizes the site needs. Source: public/icons/github_community_logo.png
   (white on transparent — the Octocat circle with "GitHub COMMUNITY GITAM" under it).
   Run: node scripts/brand.mjs
     public/brand/club-mark.png      the circle alone, for small sizes (header, certificates, admin)
     public/brand/club-logo.png      the full logo, trimmed, for dark backgrounds (footer)
     public/brand/favicon-32.png     browser tab: the mark on the club's black circle
     public/brand/apple-touch.png    home-screen icon (iOS rounds the corners itself) */
import sharp from "sharp";
import fs from "node:fs";

const SRC = "public/icons/github_community_logo.png", OUT = "public/brand";
const MARK = { left: 62, top: 11, width: 160, height: 160 }; // the circle, measured from the source's transparency
fs.mkdirSync(OUT, { recursive: true });
const ink = { r: 11, g: 11, b: 15, alpha: 1 };

const mark = await sharp(SRC).extract(MARK).png().toBuffer();
await sharp(mark).toFile(`${OUT}/club-mark.png`);
await sharp(SRC).trim({ threshold: 1 }).png().toFile(`${OUT}/club-logo.png`);

const onCircle = async (size, pad, round) => {
  const art = await sharp(mark).resize(Math.round(size * (1 - pad * 2))).png().toBuffer();
  const disc = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${round ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#0b0b0f"/>` : `<rect width="${size}" height="${size}" fill="#0b0b0f"/>`}</svg>`);
  return sharp({ create: { width: size, height: size, channels: 4, background: { ...ink, alpha: 0 } } }).composite([{ input: disc }, { input: art, gravity: "center" }]).png();
};
await (await onCircle(32, 0.12, true)).toFile(`${OUT}/favicon-32.png`);
await (await onCircle(180, 0.16, false)).toFile(`${OUT}/apple-touch.png`);
console.log("brand assets written to", OUT);
