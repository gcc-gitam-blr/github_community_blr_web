"use client";
import { useState } from "react";
import { Lightbox, SampleTile, photoSrc, type Photo } from "@/components/site/Lightbox";
import { Reveal } from "@/components/ui/Reveal";

/* A moment's photos, laid on a table like prints: up to four, each slightly tilted, the rest behind "+N".
   Every print opens the full-screen viewer at that photo, and the viewer walks through all of them. */
const TILTS = [-2.2, 1.6, -1.1, 2.4, -1.7, 1.2, 2, -2.6];
// [grid cell, cropped shape] for 1, 2, 3 and 4 prints; the offsets make it feel set down by hand, not tiled
const LAYOUT: [string, string][][] = [
  [],
  [["col-span-2 mx-auto w-[min(100%,560px)]", ""]],
  [["", "4 / 5"], ["mt-10 -ml-3 sm:-ml-5", "4 / 5"]],
  [["col-span-2 w-[84%]", "16 / 10"], ["-mt-8 ml-[8%]", "4 / 3"], ["mt-1 -ml-2", "4 / 3"]],
  [["", "4 / 3"], ["mt-8", "1 / 1"], ["-mt-6", "1 / 1"], ["mt-3", "4 / 3"]],
];

export function Prints({ photos, title, seed = 0 }: { photos: Photo[]; title: string; seed?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = photos.slice(0, 4), more = photos.length - shown.length, layout = LAYOUT[shown.length];
  return (
    <>
      <Reveal group>
        <ul className="grid grid-cols-2 items-start gap-x-3 gap-y-4 sm:gap-x-5 sm:gap-y-5" aria-label={`Photos: ${title}`}>
          {shown.map((p, i) => {
            const [cell, shape] = layout[i], crop = shape || (p.h > p.w * 1.25 ? "4 / 5" : `${p.w} / ${p.h}`); // a lone print keeps its shape, unless very tall
            return (
              <li key={p.id} className={`print-in relative ${cell}`} style={{ "--sd": `${i * 0.08}s` } as React.CSSProperties}>
                <button type="button" onClick={() => setOpen(i)} className="print focus-visible:outline-offset-4" style={{ "--tilt": `${TILTS[(seed + i) % TILTS.length]}deg` } as React.CSSProperties}
                  aria-label={i === shown.length - 1 && more > 0 ? `Open photo ${i + 1} of ${photos.length} (and ${more} more): ${p.alt}` : `Open photo ${i + 1} of ${photos.length}: ${p.alt}`}>
                  <span className="block overflow-hidden rounded-[1px] bg-soft" style={{ aspectRatio: crop }}>
                    {p.sample
                      ? <SampleTile p={p} className="h-full w-full" style={{ aspectRatio: "auto" }} />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={photoSrc(p, "md")} srcSet={`${photoSrc(p, "sm")} 480w, ${photoSrc(p, "md")} 960w`} sizes={shown.length === 1 ? "(min-width: 768px) 560px, 92vw" : "(min-width: 768px) 360px, 46vw"} width={p.w} height={p.h} alt={p.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                  </span>
                  {i === shown.length - 1 && more > 0 && (
                    <span aria-hidden className="absolute inset-[6px] grid place-content-center gap-0.5 rounded-[1px] bg-ink/65 text-center text-white sm:inset-[8px]">
                      <span className="font-display text-[clamp(26px,4vw,38px)] font-extrabold leading-none">+{more}</span>
                      <span className="text-[13px] font-medium text-white/85">more</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Reveal>
      <Lightbox photos={photos} open={open} setOpen={setOpen} />
    </>
  );
}
