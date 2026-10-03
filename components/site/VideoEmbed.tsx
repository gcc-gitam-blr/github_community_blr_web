"use client";
import { useState } from "react";
import { PlayIcon } from "@primer/octicons-react";

/* A YouTube video that loads nothing from YouTube but its thumbnail until someone presses play
   (then the privacy-friendly youtube-nocookie player). Keeps event pages fast. */
export function VideoEmbed({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[14px] border border-line bg-ink">
      {playing ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full" />
      ) : (
        <button onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`} className="group absolute inset-0 grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
          <span className="press relative grid h-16 w-16 place-items-center rounded-full bg-white text-ink shadow-lg transition group-hover:scale-105"><PlayIcon size={28} /></span>
        </button>
      )}
    </div>
  );
}
