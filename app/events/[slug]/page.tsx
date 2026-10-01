import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CalendarIcon, FileZipIcon, LinkExternalIcon, LocationIcon, TagIcon } from "@primer/octicons-react";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NodeIcon } from "@/components/ui/GitGraph";
import { Sticker } from "@/components/ui/Sticker";
import { CLUB, commitHash } from "@/lib/config";
import { EVENTS, eventDate, eventSlug, eventTag, findEvent } from "@/lib/events";
import { SITE_URL } from "@/lib/site";
import { ShareButton } from "./ShareButton";
import { LatestBadge } from "./LatestBadge";
import { FeedbackForm } from "./FeedbackForm";

/* Each event is a "release" of the club: a tag, release notes, and assets (calendar file, link). */
export const dynamicParams = false;
export const generateStaticParams = () => EVENTS.map((e) => ({ slug: eventSlug(e) }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = findEvent((await params).slug);
  if (!e) return {};
  return { title: e.title, description: `${eventDate(e)} · ${e.where}. ${e.text}`, openGraph: { title: e.title, description: e.text, type: "article" } };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const e = findEvent((await params).slug);
  if (!e) notFound();
  const i = EVENTS.indexOf(e), prev = EVENTS[i - 1], next = EVENTS[i + 1];
  const url = `${SITE_URL}/events/${eventSlug(e)}`;

  // schema.org Event — lets search engines show the date and place
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Event", name: e.title, description: e.text,
    startDate: e.date, ...(e.dateLabel ? {} : { endDate: e.date }),
    eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: "GITAM University, Bengaluru", address: { "@type": "PostalAddress", addressLocality: "Bengaluru", addressRegion: "Karnataka", addressCountry: "IN" } },
    organizer: { "@type": "Organization", name: CLUB.name, url: SITE_URL }, url,
  };

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-[1040px] px-5 pb-24 pt-[120px] md:px-10">
        <Link href="/#events" className="mb-8 inline-flex items-center gap-2 text-[14px] text-link hover:underline"><ArrowLeftIcon size={16} />All events</Link>

        <div className="grid gap-8 md:grid-cols-[180px_1fr]">
          {/* left rail: the tag, like GitHub's releases list */}
          <aside className="flex flex-row flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-ink-2 md:flex-col md:items-start md:gap-3 md:pt-2">
            <span className="font-semibold text-ink">{e.dateLabel ?? new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            <span className="inline-flex items-center gap-1.5 font-mono"><TagIcon size={16} />{eventTag(e)}</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-ink-3"><span className="rotate-90 inline-block"><NodeIcon shape={e.shape} color={e.color} size={16} /></span>{commitHash(e.title + e.date)}</span>
          </aside>

          <article className="relative rounded-[12px] border border-line bg-white">
            <Sticker name={e.href ? "adventure" : "agenda"} size={110} tilt={8} className="absolute -right-4 -top-10 hidden sm:block" alt="" />
            <header className="border-b border-line p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[clamp(30px,4.4vw,46px)] leading-[1.05]">{e.title}</h1>
                <LatestBadge date={e.date} flagship={!!e.href} />
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[15px] text-ink-2">
                <span className="inline-flex items-center gap-1.5"><CalendarIcon size={16} />{eventDate(e)}</span>
                <span className="inline-flex items-center gap-1.5"><LocationIcon size={16} />{e.where}</span>
                <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[12px]">{e.type}</span>
              </p>
            </header>

            <div className="p-6 sm:p-8">
              <h2 className="text-[20px]">Release notes</h2>
              <p className="mt-3 max-w-[62ch] text-[17px] leading-relaxed text-ink-2">{e.text}</p>
              {(e.luma || CLUB.lumaCalendar) && (
                <a href={e.luma || CLUB.lumaCalendar} target="_blank" rel="noopener" className="mr-3 mt-6 inline-flex items-center gap-2 rounded-md bg-[#2ea043] px-5 py-3 font-display font-bold text-white">{e.luma ? "RSVP on Luma" : "See it on Luma"} ↗</a>
              )}
              {e.href && (
                <Link href={e.href} className="mt-6 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 font-display font-bold text-[#ffc933]">Open Epoch →</Link>
              )}

              <details open className="mt-8 rounded-lg border border-line">
                <summary className="cursor-pointer select-none px-4 py-3 text-[15px] font-semibold">Assets <span className="ml-1 rounded-full bg-soft px-2 py-0.5 text-[12px] font-normal text-ink-3">3</span></summary>
                <ul className="divide-y divide-line border-t border-line text-[14.5px]">
                  <li><a href={`/events/${eventSlug(e)}/event.ics`} download className="flex items-center gap-3 px-4 py-3 text-link hover:bg-soft"><FileZipIcon size={16} /><span className="flex-1 font-semibold">{eventSlug(e)}.ics</span><span className="text-ink-3">Add to calendar</span></a></li>
                  <li><a href="/calendar.ics" download className="flex items-center gap-3 px-4 py-3 text-link hover:bg-soft"><FileZipIcon size={16} /><span className="flex-1 font-semibold">github-community-club-2026-27.ics</span><span className="text-ink-3">All {EVENTS.length} events</span></a></li>
                  <li className="flex items-center gap-3 px-4 py-3"><LinkExternalIcon size={16} /><span className="flex-1 font-semibold">Share this event</span><ShareButton url={url} title={e.title} /></li>
                </ul>
              </details>
            </div>
          </article>
        </div>

        {e.recap && (
          <section className="mt-6 rounded-[12px] border border-line bg-white p-6 sm:p-8">
            <h2 className="text-[24px]">Recap</h2>
            <p className="mt-2 max-w-[62ch] whitespace-pre-line text-[17px] leading-relaxed text-ink-2">{e.recap.text}</p>
            {e.recap.slides && <a href={e.recap.slides} target="_blank" rel="noopener" className="mt-4 inline-block font-semibold text-link hover:underline">Slides and materials ↗</a>}
          </section>
        )}
        {!e.dateLabel && <FeedbackForm date={e.date} title={e.title} />}

        {/* older / newer, like navigating releases */}
        <nav aria-label="More events" className="mt-10 grid gap-3 sm:grid-cols-2">
          {prev ? <Link href={`/events/${eventSlug(prev)}`} className="rounded-[12px] border border-line p-4 transition hover:border-ink"><span className="text-[13px] text-ink-3">← Earlier · {eventTag(prev)}</span><span className="mt-1 block font-semibold">{prev.title}</span></Link> : <span />}
          {next && <Link href={`/events/${eventSlug(next)}`} className="rounded-[12px] border border-line p-4 text-right transition hover:border-ink"><span className="text-[13px] text-ink-3">Later · {eventTag(next)} →</span><span className="mt-1 block font-semibold">{next.title}</span></Link>}
        </nav>
        <p className="mt-10 text-center"><Link href="/#join" className="font-semibold text-link">Not a member yet? Join the club →</Link></p>
      </main>
      <SiteFooter />
    </>
  );
}
