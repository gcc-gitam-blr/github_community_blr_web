/* GitHub's animated 3D stickers (the spinning Mona head, the rubber duck), as animated WebP made from the
   original GIFs (≈0.5 MB instead of 4–9 MB). Lazy-loaded, and people who prefer less motion get a still frame.
   Only for wide screens: callers hide it on phones, and a hidden <img loading="lazy"> is never fetched. */
export type LiveStickerName = "cat-3d" | "duck-3d";

export function LiveSticker({ name, size, alt = "", className = "" }: { name: LiveStickerName; size: number; alt?: string; className?: string }) {
  return (
    <picture className={className}>
      <source media="(prefers-reduced-motion: reduce)" srcSet={`/stickers/${name}-still.webp`} />
      <img src={`/stickers/${name}.webp`} alt={alt} width={size} height={size} loading="lazy" decoding="async" draggable={false}
        className="select-none drop-shadow-[0_10px_14px_rgba(11,11,15,.18)]" style={{ width: size, height: size }} />
    </picture>
  );
}
