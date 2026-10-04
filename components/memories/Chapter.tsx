import { ChevronDownIcon, ImageIcon, TagIcon } from "@primer/octicons-react";
import { Face } from "@/components/site/Team";
import { Reveal } from "@/components/ui/Reveal";
import { commitHash } from "@/lib/config";
import type { Chapter as ChapterData, Moment as MomentData, Quote } from "@/lib/memories";
import { Prints } from "./Prints";

/* One club year: the year, its title and story, who led it, its moments (photos on a table) and members' own words. */
const SHOWN = 3; // moments shown before the rest fold away, so a big year never becomes a long scroll
const day = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
export const yearId = (year: string) => `y${year}`;
export const yearLabel = (year: string) => year.replace("-", "–");
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Moment({ m, i, flip }: { m: MomentData; i: number; flip: boolean }) {
  const words = (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12.5px] text-ink-3">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full border-2 border-ink bg-white" />
        <span>{commitHash(m.title + (m.date ?? ""))}</span>
        {m.date && <><span aria-hidden>·</span><time dateTime={m.date}>{day(m.date)}</time></>}
      </p>
      <h3 className="mt-2.5 text-[clamp(22px,2.6vw,30px)]">{m.title}</h3>
      {m.caption && <p className="mt-3 max-w-[46ch] whitespace-pre-line text-[16.5px] leading-relaxed text-ink-2">{m.caption}</p>}
      {m.photos.length > 1 && <p className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] text-ink-3"><ImageIcon size={14} />{m.photos.length} photos</p>}
    </div>
  );
  if (!m.photos.length) return <li><Reveal>{words}</Reveal></li>;
  return (
    <li className={`grid items-center gap-7 md:gap-12 ${flip ? "md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]" : "md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]"}`}>
      <Reveal className={flip ? "md:order-2" : ""}>{words}</Reveal>
      <div className="rounded-[22px] bg-soft px-4 py-6 sm:p-8"><Prints photos={m.photos} title={m.title} seed={i * 3} /></div>
    </li>
  );
}

function Said({ q }: { q: Quote }) {
  return (
    <Reveal as="figure" className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-white">
      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-soft px-4 py-2.5 text-[13.5px] text-ink-2">
        <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-node-purple font-display text-[10px] font-bold text-ink">{initials(q.name)}</span>
        <b className="font-semibold text-ink">{q.name}</b>{q.role && <span className="text-ink-3">{q.role}</span>}
      </figcaption>
      <blockquote className="px-5 py-4 text-[18px] leading-relaxed">{q.text}</blockquote>
    </Reveal>
  );
}

export function Chapter({ c, current, first }: { c: ChapterData; current: boolean; first: boolean }) {
  const photos = c.moments.some((m) => m.photos.length);
  const shown = c.moments.slice(0, SHOWN), rest = c.moments.slice(SHOWN);
  const list = (ms: MomentData[], from: number) => <ol className="space-y-16 sm:space-y-24">{ms.map((m, i) => <Moment key={m.title + i} m={m} i={from + i} flip={(from + i) % 2 === 1} />)}</ol>;
  return (
    <section id={yearId(c.year)} aria-labelledby={`${yearId(c.year)}-h`} className={first ? "" : "mt-24 border-t border-line pt-16 sm:mt-32 sm:pt-20"}>
      <Reveal>
        <p className="flex flex-wrap items-center gap-2 font-mono text-[13px] text-ink-2">
          <span className="inline-flex items-center gap-1.5"><TagIcon size={14} />v{c.year}</span>
          {c.started && <span className="rounded-full border border-line px-2.5 py-0.5 font-sans text-[12px] font-semibold text-ink-2">Initial commit</span>}
          {current && <span className="rounded-full border border-[#2ea043] px-2.5 py-0.5 font-sans text-[12px] font-semibold text-[#1a7f37]">This year</span>}
        </p>
        <h2 id={`${yearId(c.year)}-h`} className="mt-3 text-[clamp(52px,12vw,140px)] leading-[0.92]">{yearLabel(c.year)}</h2>
        {c.title && <p className="mt-5 max-w-[24ch] font-display text-[clamp(24px,3vw,36px)] font-semibold leading-[1.12] tracking-[-0.02em]">{c.title}</p>}
        {c.story && <div className="mt-6 max-w-[60ch] space-y-4 text-[18px] leading-relaxed text-ink-2">{c.story.split(/\n\s*\n/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}</div>}
      </Reveal>

      {c.leaders.length > 0 && (
        <Reveal className="mt-9">
          <p className="font-mono text-[12.5px] text-ink-3">{current ? "Led by" : "Led that year by"}</p>
          <ul className="mt-3 flex flex-wrap gap-x-7 gap-y-4">
            {c.leaders.map((l, i) => (
              <li key={l.name} className="flex items-center gap-3">
                <span className="h-11 w-11 flex-none overflow-hidden rounded-full border border-line bg-soft"><Face p={l} px={44} i={i} text="text-[14px]" /></span>
                <span className="leading-tight"><span className="block font-semibold">{l.name}</span><span className="mt-0.5 block text-[13.5px] text-ink-3">{l.role}</span></span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {c.moments.length > 0 && <div className="mt-16 sm:mt-20">{list(shown, 0)}</div>}
      {rest.length > 0 && (
        <details className="group mt-14">
          <summary className="press inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-[15px] font-semibold hover:border-ink/40">
            <span className="group-open:hidden">{rest.length} more moment{rest.length === 1 ? "" : "s"} from {yearLabel(c.year)}</span><span className="hidden group-open:inline">Fewer moments</span>
            <ChevronDownIcon size={16} className="text-ink-3 transition-transform duration-200 ease-out group-open:rotate-180" />
          </summary>
          <div className="mt-16">{list(rest, SHOWN)}</div>
        </details>
      )}

      {!photos && (
        <p className="mt-12 flex max-w-[640px] items-start gap-3 rounded-[14px] border-2 border-dashed border-line px-5 py-4 text-[15.5px] text-ink-2">
          <ImageIcon size={18} className="mt-0.5 flex-none text-ink-3" />Photos from {yearLabel(c.year)} are on their way.
        </p>
      )}

      {c.quotes.length > 0 && (
        <div className="mt-16 sm:mt-20">
          <p className="font-mono text-[12.5px] text-ink-3">In their words</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{c.quotes.map((q, i) => <Said key={q.name + i} q={q} />)}</div>
        </div>
      )}
    </section>
  );
}
