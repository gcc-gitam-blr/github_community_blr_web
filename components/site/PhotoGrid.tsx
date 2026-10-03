"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@primer/octicons-react";

/* Masonry photo grid with a keyboard-friendly lightbox (Esc, ← →). Used by the home Gallery and event recaps.
   Photos come from scripts/photos.mjs. */
export interface Photo { id: string; event: string; eventTitle: string; index: number; w: number; h: number; alt: string; caption: string }
const src = (p: Photo, s: "sm" | "md" | "lg") => `/gallery/${p.event}/${p.index}-${s}.webp`;

export function PhotoGrid({ photos, cols = "columns-2 md:columns-3" }: { photos: Photo[]; cols?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    const d = dialog.current; if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);
  useEffect(() => {
    if (open === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, step]);

  const cur = open !== null ? photos[open] : null;
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

      <dialog ref={dialog} onClose={close} onClick={(e) => e.target === dialog.current && close()} aria-label="Photo viewer" className="m-auto h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90">
        {cur && (
          <div className="grid h-full grid-rows-[1fr_auto] p-3 sm:p-6" data-lenis-prevent>
            <div className="relative grid min-h-0 place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={cur.id} src={src(cur, "lg")} width={cur.w} height={cur.h} alt={cur.alt} className="max-h-full max-w-full rounded-lg object-contain" />
              <button onClick={close} aria-label="Close" className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"><XIcon size={20} /></button>
              {photos.length > 1 && <>
                <button onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"><ArrowLeftIcon size={20} /></button>
                <button onClick={() => step(1)} aria-label="Next photo" className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"><ArrowRightIcon size={20} /></button>
              </>}
            </div>
            <p className="pt-4 text-center text-[15px] text-white/85" aria-live="polite">{cur.caption || cur.eventTitle} <span className="ml-2 font-mono text-[12px] text-white/50">{(open ?? 0) + 1} / {photos.length}</span></p>
          </div>
        )}
      </dialog>
    </>
  );
}
