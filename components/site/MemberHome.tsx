import Link from "next/link";
import { NodeIcon } from "@/components/ui/GitGraph";
import { certTheme } from "@/lib/certificates";
import { EVENTS, eventSlug, type ClubEvent } from "@/lib/events";

/* The member's own corner of My club: the year as their contribution graph, the certificates they have collected
   (one design per event, so there is something to collect), and what's next. Pure: it gets the attended dates. */
type Attended = { id: string; event: string };
const shapeOf = (e: ClubEvent) => (e.shape ?? "diamond") as "diamond" | "square" | "ring" | "triangle";
const colorOf = (e: ClubEvent) => (e.color ?? "green") as "blue" | "purple" | "mint" | "green";
const short = (iso: string) => new Date(`${iso}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** One square per event this year: filled where you came, outlined where it's still to come, faint where you missed it. */
export function YearStrip({ attended, today }: { attended: Attended[]; today: string }) {
  const came = new Set(attended.map((a) => a.event));
  return (
    <ol className="mt-4 flex flex-wrap gap-2" aria-label="The club's events this year">
      {EVENTS.map((e) => {
        const was = came.has(e.date), ahead = e.date >= today;
        return (
          <li key={e.date} title={`${e.title}: ${was ? "you came" : ahead ? "coming up" : "missed"}`}>
            <span className={`grid h-9 w-9 place-items-center rounded-md border-2 ${was ? "border-ink bg-brand" : ahead ? "border-dashed border-ink/40 bg-white" : "border-line bg-[#ebeef0]"}`}>
              {was && <span aria-hidden className="text-[15px] font-black text-ink">✓</span>}
            </span>
            <span className="sr-only">{e.title}, {short(e.date)}: {was ? "you came" : ahead ? "coming up" : "missed"}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Every event's certificate as a little card: yours to open, or still to earn. */
export function CertWall({ attended, today }: { attended: Attended[]; today: string }) {
  const byDate = new Map(attended.map((a) => [a.event, a.id]));
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {EVENTS.map((e) => {
        const id = byDate.get(e.date), t = certTheme(e), ahead = e.date >= today;
        const card = (
          <span className={`flex h-full overflow-hidden rounded-[12px] border-2 ${id ? "border-ink bg-[#fffdf8]" : "border-dashed border-line bg-white"}`}>
            <span className={`flex w-[58px] flex-none items-center justify-center border-r-2 ${id ? "border-ink" : "border-dashed border-line"}`} style={{ background: id ? t.tint : undefined }}>
              <span className={id ? "" : "opacity-40 grayscale"}><NodeIcon shape={shapeOf(e)} color={colorOf(e)} size={30} /></span>
            </span>
            <span className="min-w-0 flex-1 px-3.5 py-3">
              <span className={`block truncate font-semibold ${id ? "" : "text-ink-2"}`}>{e.title}</span>
              <span className="block font-mono text-[12.5px] text-ink-3">{e.dateLabel ?? short(e.date)}</span>
              <span className={`mt-1 block text-[13.5px] ${id ? "font-semibold text-[#116329]" : "text-ink-3"}`}>{id ? "Your certificate →" : ahead ? "Come to earn this one" : "Not collected"}</span>
            </span>
          </span>
        );
        return <li key={e.date}>{id ? <Link href={`/certificates/${id}`} className="lift block h-full rounded-[12px]">{card}</Link> : ahead ? <Link href={`/events/${eventSlug(e)}`} className="block h-full rounded-[12px] transition hover:-translate-y-0.5">{card}</Link> : card}</li>;
      })}
    </ul>
  );
}

/** The next event, as the thing to do next. */
export function NextUp({ today }: { today: string }) {
  const e = EVENTS.find((x) => x.date >= today);
  if (!e) return null;
  const days = Math.round((Date.parse(e.date) - Date.parse(today)) / 864e5);
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[14px] border-2 border-ink bg-white p-5">
      <NodeIcon shape={shapeOf(e)} color={colorOf(e)} size={40} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[12.5px] text-ink-3">Next up · {e.dateLabel ?? (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`)}</p>
        <p className="mt-0.5 truncate text-[19px] font-semibold">{e.title}</p>
      </div>
      {e.luma ? <a href={e.luma} target="_blank" rel="noopener" className="press rounded-md bg-ink px-4 py-2.5 font-display text-[15px] font-bold text-white">RSVP ↗</a>
        : <Link href={`/events/${eventSlug(e)}`} className="press rounded-md bg-ink px-4 py-2.5 font-display text-[15px] font-bold text-white">See the event</Link>}
    </div>
  );
}
