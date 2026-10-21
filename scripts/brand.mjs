/* The club's logo and icons, in the sizes the site needs. Run: node scripts/brand.mjs
   Two sources:
   - public/icons/github_community_logo.png, the club's logo (white on transparent: the Octocat circle with
     "GitHub COMMUNITY GITAM" under it), for places big enough to show it:
       public/brand/club-mark.png      the circle alone (header, certificates, admin)
       public/brand/club-logo.png      the full logo, trimmed, for dark backgrounds (footer)
   - public/favicon.svg, the branch mark (a green branch off a white commit, on black), for the tiny places. The Octocat
     alone is GitHub's own icon: in a row of tabs next to github.com nobody could tell which one is the club.
       public/brand/favicon-32.png     browser tab, for browsers without SVG icons
       public/favicon.ico              16, 32 and 48 px, for anything that asks for /favicon.ico
       public/brand/apple-touch.png    home-screen icon (iOS rounds the corners itself) */
import sharp from "sharp";
import fs from "node:fs";

const SRC = "public/icons/github_community_logo.png", OUT = "public/brand";
const MARK = { left: 62, top: 11, width: 160, height: 160 }; // the circle, measured from the source's transparency
fs.mkdirSync(OUT, { recursive: true });

const mark = await sharp(SRC).extract(MARK).png().toBuffer();
await sharp(mark).toFile(`${OUT}/club-mark.png`);
await sharp(SRC).trim({ threshold: 1 }).png().toFile(`${OUT}/club-logo.png`);

// the branch mark: round for tabs, and as a full black square for the home screen (iOS cuts its own rounded corners)
const svg = fs.readFileSync("public/favicon.svg", "utf8");
const square = svg.replace(/<circle cx="20" cy="20" r="20" fill="#0b0b0f"\/>/, '<rect width="40" height="40" fill="#0b0b0f"/>');
if (square === svg) throw new Error("public/favicon.svg changed shape: update the black circle match in scripts/brand.mjs");
const png = (src, size) => sharp(Buffer.from(src), { density: 72 * size / 40 * 4 }).resize(size, size).png().toBuffer();

fs.writeFileSync(`${OUT}/favicon-32.png`, await png(svg, 32));
fs.writeFileSync(`${OUT}/apple-touch.png`, await png(square, 180));

// favicon.ico: an icon directory holding PNGs (every current browser reads PNG inside .ico)
const sizes = [16, 32, 48], images = await Promise.all(sizes.map((s) => png(svg, s)));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(images[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
fs.writeFileSync("public/favicon.ico", Buffer.concat([head, ...images]));
console.log("brand assets written to", OUT, "and public/favicon.ico");
