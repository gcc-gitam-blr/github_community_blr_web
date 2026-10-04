import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SampleTile, photoSrc, type Photo } from "@/components/site/Lightbox";
import { Chapter, yearId } from "@/components/memories/Chapter";
import { YearRail } from "@/components/memories/YearRail";
import { Alumni } from "@/components/memories/Alumni";
import { ALUMNI } from "@/lib/alumni";
import { Reveal } from "@/components/ui/Reveal";
import { Sticker } from "@/components/ui/Sticker";
import { CLUB } from "@/lib/config";
import { MEMORIES, MEMORIES_LINKED, SHOW_SAMPLE, WORDS, sampleMemories, thanks } from "@/lib/memories";

/* The club's story as a git log, oldest first: a story is told from the beginning, and reading forward
   ends on today, the people to thank, and the next chapter, which is the reader's own.
   Until there are real photos the page exists but isn't linked anywhere (lib/memories.ts: MEMORIES_LINKED). */
export const metadata: Metadata = {
  title: "Memories",
  description: "The club's story, one year at a time: the people who led it, the sessions, and the moments in between.",
  robots: MEMORIES_LINKED ? undefined : { index: false }, // quiet until there are photos
};

const wrap = "mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]";
const DOTS = ["bg-node-blue", "bg-node-purple", "bg-node-mint", "bg-brand"];

function Intro({ cover }: { cover?: Photo }) {
  const words = (light: boolean) => (
    <>
      <p className={`hero-fade font-mono text-[13px] ${light ? "text-white/80" : "text-ink-2"}`}>{"// git log --reverse"}</p>
      <h1 className={`hero-rise mt-4 text-[clamp(50px,12.5vw,156px)] leading-[0.9] ${light ? "text-white" : ""}`} style={{ "--d": ".08s" } as React.CSSProperties}>Memories.</h1>
      <p className={`hero-rise mt-6 max-w-[52ch] text-[clamp(18px,1.7vw,21px)] leading-relaxed ${light ? "text-white/90" : "text-ink-2"}`} style={{ "--d": ".16s" } as React.CSSProperties}>{WORDS.intro}</p>
    </>
  );
  if (!cover) return (
    <header className={`${wrap} pt-[clamp(120px,14vw,170px)]`}>
      <div className="flex items-end justify-between gap-8"><div className="min-w-0">{words(false)}</div><Sticker name="film" size={170} tilt={6} className="mb-6 hidden flex-none md:block" alt="" /></div>
    </header>
  );
  return (
    <header className="relative isolate flex h-[min(88svh,880px)] min-h-[540px] items-end overflow-hidden bg-ink">
      {cover.sample
        ? <div className="drift absolute inset-0 -z-10"><SampleTile p={cover} className="h-full w-full" style={{ aspectRatio: "auto" }} art="absolute right-[7%] top-[16%] w-[min(30vw,300px)]" tag="left-5 top-[92px] md:left-[clamp(20px,5vw,72px)]" /></div>
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={photoSrc(cover, "lg")} srcSet={`${photoSrc(cover, "md")} 960w, ${photoSrc(cover, "lg")} 1800w`} sizes="100vw" alt={cover.alt} fetchPriority="high" className="drift absolute inset-0 -z-10 h-full w-full object-cover" />}
      {/* a soft shade under the words so they stay readable on any photo */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(11,11,15,.78),rgba(11,11,15,.32)_42%,rgba(11,11,15,0)_70%)]" />
      <div className={`${wrap} pb-[clamp(36px,6vw,72px)]`}>{words(true)}</div>
    </header>
  );
}

/** The years as one branch, to jump to any of them. Scrolls inside itself if the club ever has more years than fit. */
function YearLine({ years }: { years: string[] }) {
  return (
    <nav aria-label="Jump to a year" className="mt-10 overflow-x-auto pb-2 lg:hidden">
      <ol className="flex min-w-max items-center">
        {years.map((y, i) => (
          <li key={y} className="flex items-center">
            <a href={`#${yearId(y)}`} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 font-mono text-[12.5px] text-ink-2 hover:border-ink/40 hover:text-ink sm:px-3 sm:text-[13px]">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full border-2 ${i === years.length - 1 ? "border-[#1a7f37] bg-[#2da44e]" : "border-ink bg-ink"}`} />{y}
            </a>
            <span aria-hidden className={`h-[2px] w-5 sm:w-10 ${i === years.length - 1 ? "bg-[repeating-linear-gradient(90deg,rgba(11,11,15,.3)_0_4px,transparent_4px_8px)]" : "bg-ink"}`} />
          </li>
        ))}
        <li><a href="#next" className="flex items-center gap-1.5 rounded-full border border-dashed border-ink/30 px-2.5 py-1.5 font-mono text-[12.5px] text-ink-2 hover:text-ink sm:px-3 sm:text-[13px]">you</a></li>
      </ol>
    </nav>
  );
}

export default function MemoriesPage() {
  const sample = SHOW_SAMPLE && !MEMORIES.photos;
  const { chapters, cover } = sample ? sampleMemories(MEMORIES) : MEMORIES;
  const names = thanks();
  const stops = [...chapters.map((c) => ({ id: yearId(c.year), label: c.year, hint: c.title })), { id: "thanks", label: "Thank you" }, { id: "alumni", label: "Alumni", hint: "where they are now" }, { id: "next", label: "you", hint: "the next chapter", next: true }];

  return (
    <>
      <a href="#chapters" className="press sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-white">Skip to the first year</a>
      <Nav />
      <main>
        <Intro cover={cover} />
        <div className={wrap}>
          <YearLine years={chapters.map((c) => c.year)} />
          {sample && <p className="mt-8 rounded-lg border border-[#d4a72c66] bg-[#fff8c5] px-4 py-3 text-[15px] text-[#7d4e00]">Sample: the tiles, titles, stories, moments and quotes are placeholders, shown on preview deployments only while there are no real photos. The years and the people who led them are real. The live site never shows this.</p>}
        </div>

        <div id="chapters" className={`${wrap} grid gap-12 pb-28 pt-[clamp(56px,8vw,104px)] lg:grid-cols-[170px_minmax(0,1fr)] lg:gap-16`}>
          <aside><YearRail stops={stops} /></aside>
          <div className="min-w-0">
            {chapters.map((c, i) => <Chapter key={c.year} c={c} current={c.year === CLUB.year} first={i === 0} />)}

            <section id="thanks" aria-labelledby="thanks-h" className="mt-28 border-t border-line pt-16 sm:mt-36 sm:pt-20">
              <Reveal className="flex items-end justify-between gap-8">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-ink-2">{"// git shortlog --summary --all"}</p>
                  <h2 id="thanks-h" className="mt-4 text-[clamp(46px,8vw,104px)] leading-[0.95]">Thank you.</h2>
                  <p className="mt-6 max-w-[54ch] text-[19px] leading-relaxed text-ink-2">{WORDS.thanks}</p>
                </div>
                <Sticker name="heart" size={150} tilt={-6} className="mb-2 hidden flex-none md:block" alt="" />
              </Reveal>
              <Reveal group className="mt-12">
                <ul className="stagger flex flex-wrap items-baseline gap-x-[clamp(18px,2.4vw,34px)] gap-y-[clamp(8px,1.2vw,14px)]">
                  {names.map((n, i) => (
                    <li key={n} className="inline-flex items-baseline gap-2.5 font-display text-[clamp(22px,3.1vw,40px)] font-bold leading-tight tracking-[-0.02em]" style={{ "--sd": `${Math.min(i * 0.025, 0.6)}s` } as React.CSSProperties}>
                      <span aria-hidden className={`h-2.5 w-2.5 flex-none translate-y-[-0.2em] rounded-full border-2 border-ink ${DOTS[i % DOTS.length]}`} />{n}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <p className="mt-10 text-[15px] text-ink-3">{WORDS.missing}</p>
            </section>

            <Alumni alumni={ALUMNI} />

            <section id="next" aria-labelledby="next-h" className="mt-28 sm:mt-36">
              <Reveal className="relative overflow-hidden rounded-[28px] border-2 border-dashed border-ink/25 px-6 py-14 text-center sm:px-12 sm:py-20">
                <Sticker name="welcome" size={130} tilt={8} className="absolute -right-3 top-6 hidden sm:block" alt="" />
                <span aria-hidden className="mx-auto block h-5 w-5 rounded-full border-2 border-dashed border-ink/60 bg-white" />
                <p className="mt-4 font-mono text-[13px] text-ink-2">git checkout -b your-story</p>
                <h2 id="next-h" className="mx-auto mt-4 max-w-[14ch] text-[clamp(40px,6.4vw,84px)]">{WORDS.nextTitle}</h2>
                <p className="mx-auto mt-6 max-w-[48ch] text-[19px] leading-relaxed text-ink-2">{WORDS.nextText}</p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <Link href="/#join" className="press inline-flex rounded-md bg-ink px-6 py-3.5 font-display font-bold text-white transition-colors duration-150 hover:bg-ink/85">Join the club</Link>
                  <Link href="/#events" className="press inline-flex rounded-md border-2 border-ink px-6 py-3 font-display font-bold transition-colors duration-150 hover:bg-soft">See what&apos;s coming up</Link>
                </div>
              </Reveal>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
