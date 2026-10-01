"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@primer/octicons-react";
import gallery from "@/lib/gallery.json";

/* Photos from past sessions, built by scripts/photos.mjs. The section hides itself until there are photos.
   Masonry columns, an event filter, and a keyboard-friendly lightbox (Esc, ← →). */
export interface Photo { id: string; event: string; eventTitle: string; index: number; w: number; h: number; alt: string; caption: string }
const PHOTOS = gallery as Photo[];
const src = (p: Photo, s: "sm" | "md" | "lg") => `/gallery/${p.event}/${p.index}-${s}.webp`;

export function Gallery({ photos = PHOTOS }: { photos?: Photo[] }) {
  const events = useMemo(() => [...new Map(photos.map((p) => [p.event, p.eventTitle])).entries()], [photos]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = useMemo(() => (filter === "all" ? photos : photos.filter((p) => p.event === filter)), [photos, filter]);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + shown.length) % shown.length)), [shown.length]);

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

  if (!photos.length) return null;
  const cur = open !== null ? shown[open] : null;

  return (
    <section id="gallery" className="py-[clamp(64px,8vw,112px)]">
      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]">
        <div className="mb-[clamp(28px,4vw,48px)] max-w-[760px]">
          <span className="font-mono text-[13px] text-ink-2">{"// gallery"}</span>
          <h2 className="mt-4 text-[clamp(38px,5.6vw,68px)]">Moments from<br />our sessions.</h2>
        </div>

        {events.length > 1 && (
          <div role="tablist" aria-label="Filter photos by event" className="mb-8 flex flex-wrap gap-2">
            {[["all", "All"], ...events].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`rounded-full border px-4 py-2 text-[14px] font-medium transition ${filter === id ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>{label}</button>
            ))}
          </div>
        )}

        <ul className="columns-2 gap-3 md:columns-3 md:gap-4">
          {shown.map((p, i) => (
            <li key={p.id} className="mb-3 break-inside-avoid md:mb-4">
              <button onClick={() => setOpen(i)} className="group block w-full overflow-hidden rounded-[14px] border border-line bg-soft focus-visible:outline-offset-4" aria-label={`Open photo: ${p.alt}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src(p, "md")} srcSet={`${src(p, "sm")} 480w, ${src(p, "md")} 960w`} sizes="(min-width: 768px) 33vw, 50vw" width={p.w} height={p.h} alt={p.alt} loading="lazy" decoding="async" className="h-auto w-full transition duration-500 group-hover:scale-[1.03]" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <dialog ref={dialog} onClose={close} onClick={(e) => e.target === dialog.current && close()} aria-label="Photo viewer" className="m-auto h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90">
        {cur && (
          <div className="grid h-full grid-rows-[1fr_auto] p-3 sm:p-6" data-lenis-prevent>
            <div className="relative grid min-h-0 place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={cur.id} src={src(cur, "lg")} width={cur.w} height={cur.h} alt={cur.alt} className="max-h-full max-w-full rounded-lg object-contain" />
              <button onClick={close} aria-label="Close" className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"><XIcon size={20} /></button>
              {shown.length > 1 && <>
                <button onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"><ArrowLeftIcon size={20} /></button>
                <button onClick={() => step(1)} aria-label="Next photo" className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"><ArrowRightIcon size={20} /></button>
              </>}
            </div>
            <p className="pt-4 text-center text-[15px] text-white/85" aria-live="polite">{cur.caption || cur.eventTitle} <span className="ml-2 font-mono text-[12px] text-white/50">{(open ?? 0) + 1} / {shown.length}</span></p>
          </div>
        )}
      </dialog>
    </section>
  );
}
