/* Turns the hand-picked Octodex stickers in public/GitHub_stickers (not committed, 47 MB)
   into small WebP files in public/stickers. Run: node scripts/stickers.mjs */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
const SRC = "public/GitHub_stickers", OUT = "public/stickers";
const PICK = {
  octocat: "original.png", agenda: "agendacat.png", welcome: "welcometocat.png", professor: "Professortocat_v2.png",
  coder: "femalecodertocat.png", jetpack: "jetpacktocat.png", maker: "manufacturetocat.png", support: "supportcat.png",
  heart: "pythocat.png", mentor: "momtocat.png", riveter: "mona-the-rivetertocat.png", world: "benevocats.png",
  list: "orderedlistocat.png", skate: "skatetocat.png", swag: "swagtocat.png", adventure: "adventure-cat.png",
  bouncer: "bouncercat.png", film: "filmtocat.png", shop: "shoptocat.png", waldo: "waldocat.png", pop: "poptocat_v2.png",
  deckfail: "deckfailcat.png", cherry: "cherryontop-o-cat.png", founder: "foundingfather_v2.png",
};
fs.mkdirSync(OUT, { recursive: true });
  for (const [name, file] of Object.entries(PICK)) {
    const src = path.join(SRC, file);
    if (!fs.existsSync(src)) { console.warn("missing", file); continue; }
    await sharp(src).trim({ threshold: 1 }).resize(420, 420, { fit: "inside", withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(OUT, name + ".webp"));
  }
  const kb = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0) / 1024;
  console.log(`${fs.readdirSync(OUT).length} stickers → ${OUT} (${kb.toFixed(0)} KB)`);
