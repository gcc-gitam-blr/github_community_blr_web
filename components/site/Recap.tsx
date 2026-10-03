import { LinkExternalIcon, VideoIcon } from "@primer/octicons-react";
import type { ClubEvent } from "@/lib/events";
import { recapPhotos, youtubeId, type Recap as RecapData } from "@/lib/recap";
import { PhotoGrid, type Photo } from "./PhotoGrid";
import { VideoEmbed } from "./VideoEmbed";

/* "What happened" at an event: numbers, the story, photos, a video and the slides. Every part is optional except the text. */
export function Recap({ event, recap, photos = recapPhotos(event, recap), sample = false }: { event: ClubEvent; recap: RecapData; photos?: Photo[]; sample?: boolean }) {
  const yt = recap.video ? youtubeId(recap.video) : null;
  return (
    <section id="recap" aria-labelledby="recap-title" className="mt-6 overflow-hidden rounded-[12px] border border-line bg-white md:ml-[212px]">
      {sample && <p className="border-b border-[#d4a72c66] bg-[#fff8c5] px-6 py-2.5 text-[13.5px] text-[#7d4e00] sm:px-8">Sample recap — shown on preview deployments only, never on the live site.</p>}
      <div className="p-6 sm:p-8">
        <h2 id="recap-title" className="text-[24px]">Recap</h2>

        {!!recap.numbers?.length && (
          <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-px overflow-hidden rounded-lg border border-line bg-line">
            {recap.numbers.map((n) => (
              <div key={n.label} className="flex flex-col gap-1 bg-white px-4 py-3">
                <dt className="text-[13.5px] leading-snug text-ink-2">{n.label}</dt>
                <dd className="order-first font-display text-[30px] font-bold leading-none tabular-nums">{n.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-5 max-w-[62ch] whitespace-pre-line text-[17px] leading-relaxed text-ink-2">{recap.text}</p>

        {photos.length > 0 && <div className="mt-8"><PhotoGrid photos={photos} cols="columns-2 sm:columns-3" /></div>}

        {yt && <div className="mt-8"><VideoEmbed id={yt} title={`${event.title} — video`} /></div>}

        {(recap.slides || (recap.video && !yt)) && (
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-semibold">
            {recap.video && !yt && <li><a href={recap.video} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-link hover:underline"><VideoIcon size={16} />Watch the video ↗</a></li>}
            {recap.slides && <li><a href={recap.slides} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-link hover:underline"><LinkExternalIcon size={16} />Slides and materials ↗</a></li>}
          </ul>
        )}
      </div>
    </section>
  );
}
