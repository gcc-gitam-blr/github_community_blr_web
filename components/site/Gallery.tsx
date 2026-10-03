"use client";
import { useMemo, useState } from "react";
import gallery from "@/lib/gallery.json";
import { PhotoGrid, type Photo } from "./PhotoGrid";

/* Photos from past sessions, built by scripts/photos.mjs. The section hides itself until there are photos.
   An event filter over the shared photo grid and lightbox. */
export type { Photo };
const PHOTOS = gallery as Photo[];

export function Gallery({ photos = PHOTOS }: { photos?: Photo[] }) {
  const events = useMemo(() => [...new Map(photos.map((p) => [p.event, p.eventTitle])).entries()], [photos]);
  const [filter, setFilter] = useState("all");
  const shown = useMemo(() => (filter === "all" ? photos : photos.filter((p) => p.event === filter)), [photos, filter]);

  if (!photos.length) return null;

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

        <PhotoGrid key={filter} photos={shown} />
      </div>
    </section>
  );
}
