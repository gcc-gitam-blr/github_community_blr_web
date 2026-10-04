"use client";
import { useCallback, useEffect, useRef } from "react";
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@primer/octicons-react";
import { DIECUT, type StickerName } from "@/components/ui/Sticker";

/* The full-screen photo viewer (Esc, ← →), shared by the photo grid (home Gallery, event recaps) and the Memories page.
   Photos come from scripts/photos.mjs. `sample` photos exist only on preview deployments: a sticker on a coloured tile, never a person. */
export interface Photo { id: string; event: string; eventTitle: string; index: number; w: number; h: number; alt: string; caption: string; sample?: { tone: string; sticker: StickerName } }
export const photoSrc = (p: Photo, s: "sm" | "md" | "lg") => `/gallery/${p.event}/${p.index}-${s}.webp`;

/** A sample photo's stand-in: the tile, the sticker, and a label so nobody mistakes it for a real photo. */
export function SampleTile({ p, className = "", style, art = "w-[42%] max-w-[240px]", tag = "left-2 top-2" }: { p: Photo; className?: string; style?: React.CSSProperties; art?: string; tag?: string }) {
  return (
    <span role="img" aria-label={p.alt} className={`relative grid place-items-center overflow-hidden ${className}`} style={{ background: p.sample!.tone, aspectRatio: `${p.w} / ${p.h}`, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/stickers/${p.sample!.sticker}-240.webp`} alt="" draggable={false} className={`select-none ${art}`} style={{ filter: DIECUT }} />
      <span className={`absolute ${tag} rounded bg-white/85 px-1.5 py-px font-mono text-[10.5px] font-semibold uppercase tracking-wide text-ink`}>Sample</span>
    </span>
  );
}

export function Lightbox({ photos, open, setOpen }: { photos: Photo[]; open: number | null; setOpen: (f: (i: number | null) => number | null) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => setOpen(() => null), [setOpen]);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length, setOpen]);

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
    <dialog ref={dialog} onClose={close} onClick={(e) => e.target === dialog.current && close()} aria-label="Photo viewer" className="m-auto h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90">
      {cur && (
        <div className="grid h-full grid-rows-[1fr_auto] p-3 sm:p-6" data-lenis-prevent>
          <div className="relative grid min-h-0 place-items-center">
            {cur.sample
              ? <SampleTile key={cur.id} p={cur} className="max-h-full rounded-lg" style={{ width: `min(100%, calc((100dvh - 120px) * ${cur.w / cur.h}))` }} />
              // eslint-disable-next-line @next/next/no-img-element
              : <img key={cur.id} src={photoSrc(cur, "lg")} width={cur.w} height={cur.h} alt={cur.alt} className="max-h-full max-w-full rounded-lg object-contain" />}
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
  );
}
