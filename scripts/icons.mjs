/* App icons for the installable Epoch wallet, rendered from public/epoch-coin.svg.
   Run: node scripts/icons.mjs */
import sharp from "sharp";
import fs from "node:fs";

const coin = fs.readFileSync("public/epoch-coin.svg");
fs.mkdirSync("public/icons", { recursive: true });
const bg = { r: 244, g: 241, b: 234, alpha: 1 }; // Epoch paper

for (const size of [192, 512]) {
  await sharp(coin).resize(size, size).png().toFile(`public/icons/epoch-${size}.png`);
  // maskable: the OS may crop to a circle/squircle, so keep the coin inside the 80% safe zone
  const inner = Math.round(size * 0.72);
  const art = await sharp(coin).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: art, gravity: "center" }]).png().toFile(`public/icons/epoch-maskable-${size}.png`);
}
const apple = await sharp(coin).resize(150, 150).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: bg } }).composite([{ input: apple, gravity: "center" }]).png().toFile("public/icons/apple-touch-icon.png");
console.log(fs.readdirSync("public/icons").join(", "));
