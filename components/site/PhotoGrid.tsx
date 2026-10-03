"use client";
import { useState } from "react";
import { Lightbox, photoSrc as src, type Photo } from "./Lightbox";

/* Masonry photo grid with a keyboard-friendly lightbox (Esc, ← →). Used by the home Gallery and event recaps.
   Photos come from scripts/photos.mjs. */
export type { Photo };

export function PhotoGrid({ photos, cols = "columns-2 md:columns-3" }: { photos: Photo[]; cols?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <ul className={`${cols} gap-3 md:gap-4`}>
        {photos.map((p, i) => (
          <li key={p.id} className="mb-3 break-inside-avoid md:mb-4">
            <button onClick={() => setOpen(i)} className="group block w-full overflow-hidden rounded-[14px] border border-line bg-soft focus-visible:outline-offset-4" aria-label={`Open photo: ${p.alt}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(p, "md")} srcSet={`${src(p, "sm")} 480w, ${src(p, "md")} 960w`} sizes="(min-width: 768px) 33vw, 50vw" width={p.w} height={p.h} alt={p.alt} loading="lazy" decoding="async" className="h-auto w-full transition duration-300 ease-out group-hover:scale-[1.03]" />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox photos={photos} open={open} setOpen={setOpen} />
    </>
  );
}
