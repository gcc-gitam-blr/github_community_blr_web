import Link from "next/link";
import { BookIcon, CodeIcon, FileIcon, TagIcon, VideoIcon } from "@primer/octicons-react";
import { EVENTS, eventSlug, eventTag } from "@/lib/events";
import { sessionMaterials, type MaterialKind } from "@/lib/materials";

/* "From our sessions": slides, recordings and links from every session, newest first, like a list of releases
   and their assets. Filled from each event's recap in the content editor; until the first one, it says what's coming. */
const ICON: Record<MaterialKind, typeof FileIcon> = { slides: FileIcon, recording: VideoIcon, code: CodeIcon, reading: BookIcon };
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function SessionArchive({ today }: { today: string }) {
  const sessions = sessionMaterials(EVENTS);
  const next = EVENTS.find((e) => e.date >= today && !e.dateLabel);
  return (
    <section className="mt-20" aria-labelledby="sessions">
      <h2 id="sessions" className="text-[clamp(30px,4vw,48px)]">From our sessions</h2>
      <p className="mt-3 max-w-[60ch] text-[17px] text-ink-2">Missed one, or want to go over it again? The slides, recordings and code from every session land here.</p>
      {sessions.length ? (
        <ol className="mt-8 divide-y divide-line overflow-hidden rounded-[16px] border border-line bg-white">
          {sessions.map(({ event, items }) => (
            <li key={event.date + event.title} className="grid gap-3 p-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-ink-3 sm:flex-col sm:items-start"><span className="font-semibold text-ink">{day(event.date)}</span><span className="inline-flex items-center gap-1 font-mono"><TagIcon size={14} />{eventTag(event)}</span></span>
              <div className="min-w-0">
                <Link href={`/events/${eventSlug(event)}#recap`} className="text-[19px] font-semibold leading-snug hover:text-link">{event.title}</Link>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {items.map((m) => { const Icon = ICON[m.kind]; return (
                    <li key={m.url}><a href={m.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[14px] font-medium transition hover:border-ink"><Icon size={14} />{m.title} <span aria-hidden className="text-ink-3">↗</span></a></li>
                  ); })}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-8 rounded-[16px] border-2 border-dashed border-line p-6 text-[16px] text-ink-2">
          Nothing here yet: the first session&apos;s slides and recording appear after it happens.
          {next && <> First up: <Link href={`/events/${eventSlug(next)}`} className="font-semibold text-link hover:underline">{next.title}</Link>, {day(next.date)}.</>}
        </p>
      )}
    </section>
  );
}
