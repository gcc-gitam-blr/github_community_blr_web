/* An Octodex sticker with a die-cut white border and a soft paper shadow.
   Names map to files in public/stickers (see scripts/stickers.mjs). */
export type StickerName =
  | "octocat" | "agenda" | "welcome" | "professor" | "coder" | "jetpack" | "maker" | "support" | "heart" | "mentor"
  | "riveter" | "world" | "list" | "skate" | "swag" | "adventure" | "bouncer" | "film" | "shop" | "waldo" | "pop"
  | "deckfail" | "cherry" | "founder";

// the border is four hard white drop-shadows around the alpha edge, then one soft shadow for lift
const DIECUT = "drop-shadow(2.5px 0 0 #fff) drop-shadow(-2.5px 0 0 #fff) drop-shadow(0 2.5px 0 #fff) drop-shadow(0 -2.5px 0 #fff) drop-shadow(0 6px 10px rgba(11,11,15,.18))";

export function Sticker({ name, size = 120, tilt = 0, alt = "", className = "" }: { name: StickerName; size?: number; tilt?: number; alt?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/stickers/${name}${size <= 70 ? "-140" : size <= 120 ? "-240" : ""}.webp`} alt={alt} width={size} height={size} loading="lazy" draggable={false}
      style={{ width: size, height: size, objectFit: "contain", filter: DIECUT, transform: tilt ? `rotate(${tilt}deg)` : undefined }}
      className={`select-none ${className}`} />
  );
}
