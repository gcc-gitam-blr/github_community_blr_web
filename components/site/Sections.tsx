import { CLUB } from "@/lib/config";
import { NodeIcon } from "@/components/ui/GitGraph";
import { Reveal } from "@/components/ui/Reveal";
import { CountUp } from "./CountUp";
import { SpotlightCard } from "./SpotlightCard";
import { TimelineLine } from "./TimelineLine";
import { EpochLink } from "@/components/epoch/EpochLink";

export function Head({ no, title, children, light = false }: { no: string; title: React.ReactNode; children?: React.ReactNode; light?: boolean }) {
  return (
    <Reveal className="mb-[clamp(40px,6vw,72px)] max-w-[760px]">
      <span className={`font-mono text-[13px] ${light ? "text-brand" : "text-ink-2"}`}>{no}</span>
      <h2 className="mt-[18px] text-[clamp(38px,6vw,72px)]">{title}</h2>
      {children && <p className={`mt-[22px] max-w-[58ch] text-[19px] ${light ? "text-[#a9b3ad]" : "text-ink-2"}`}>{children}</p>}
    </Reveal>
  );
}
const pad = "py-[clamp(80px,11vw,150px)]";
const wrap = "mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]";

export function About() {
  const tint = ["bg-node-blue", "bg-white", "bg-white", "bg-node-purple"];
  return (
    <section id="about" className={pad}>
      <div className={`${wrap} grid items-center gap-[clamp(40px,6vw,100px)] lg:grid-cols-[1.2fr_1fr]`}>
        <Head no="01 / about" title={<>A community that <em className="hl">commits</em> to each other.</>}>
          The GitHub Community Club at GITAM University Bengaluru exists for one reason: nobody should learn to code alone. Six events this year — from your first pull request to a full-scale technical month, Epoch — with a crew that helps every newcomer ship.
        </Head>
        <ul className="grid grid-cols-2 gap-4">
          {CLUB.stats.map((s, i) => (
            <Reveal as="li" key={s.label} delay={i * 0.08} className={`lift rounded-[18px] border-2 border-ink p-7 ${tint[i]}`}>
              <b className="block font-display text-[clamp(40px,5vw,64px)] font-black leading-none tracking-tighter"><CountUp to={s.value} suffix={s.suffix} /></b>
              <span className="font-mono text-[13px] uppercase tracking-widest">{s.label}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Tracks() {
  return (
    <section id="tracks" className={`${pad} bg-soft`}>
      <div className={wrap}>
        <Head no="02 / tracks" title={<>Pick a branch.<br />Go deep.</>}>Six tracks, one community. Join one, or hop between all of them — that&apos;s what branches are for.</Head>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CLUB.tracks.map((t, i) => (
            <Reveal as="li" key={t.id} delay={(i % 3) * 0.1}>
              <SpotlightCard className="group flex min-h-[290px] flex-col gap-[18px] rounded-[18px] border border-line bg-white p-[34px_30px_36px]">
                <span className="absolute right-7 top-[26px] font-mono text-[13px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="w-fit transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"><NodeIcon shape={t.shape} color={t.color} size={52} /></span>
                <h3 className="mt-auto text-[28px]">{t.title}</h3>
                <p className="leading-[1.55] text-ink-2">{t.text}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(7, "0").slice(0, 7); };

export function Events() {
  const today = new Date().toISOString().slice(0, 10);
  const list = [...CLUB.events].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section id="events" className={pad}>
      <div className={wrap}>
        <Head no="03 / events" title={<>Our commit history,<br />in the making.</>}>Every event is a commit on the club&apos;s timeline. Show up, and yours is on it too.</Head>
        <TimelineLine>
          {list.map((e, i) => (
            <Reveal as="li" key={e.title} delay={i * 0.06} className={`group relative grid grid-cols-[36px_1fr] gap-[18px] sm:grid-cols-[44px_1fr] sm:gap-[34px] ${e.date < today ? "opacity-55" : ""}`}>
              <span className="relative z-10 h-fit rounded-full bg-white transition-transform duration-500 group-hover:rotate-[14deg] group-hover:scale-110"><NodeIcon shape={e.shape} color={e.color} /></span>
              <article className="lift rounded-[18px] border-2 border-ink bg-white px-5 py-[22px] sm:px-[30px] sm:py-[26px]">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 font-mono text-[13px] text-ink-3">
                  <span className="rounded border border-line bg-soft px-2 py-0.5 text-ink-2">{hash(e.title + e.date)}</span>
                  <span>{e.dateLabel ?? new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className="rounded-full bg-brand px-2.5 py-0.5 font-bold text-ink">{e.type}</span>
                </div>
                <h3 className="mb-2 mt-3.5 text-[clamp(25px,3vw,30px)]">{e.title}</h3>
                <p className="text-ink-2">{e.text}</p>
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-[13px]">📍 {e.where}</p>{e.href && <EpochLink href={e.href} className="rounded-full bg-ink px-4 py-2 font-mono text-[13px] font-bold text-gold transition hover:-translate-y-0.5">Enter Epoch →</EpochLink>}</div>
              </article>
            </Reveal>
          ))}
        </TimelineLine>
      </div>
    </section>
  );
}

interface Repo { name: string; description: string | null; language: string | null; stars: number; url: string }

async function getRepos(): Promise<Repo[]> {
  if (!CLUB.githubOrg) return CLUB.sampleRepos;
  try {
    const res = await fetch(`https://api.github.com/orgs/${CLUB.githubOrg}/repos?sort=updated&per_page=6`, { next: { revalidate: 3600 } });
    if (!res.ok) return CLUB.sampleRepos;
    const j = (await res.json()) as { name: string; description: string | null; language: string | null; stargazers_count: number; html_url: string }[];
    return j.length ? j.map((r) => ({ name: r.name, description: r.description, language: r.language, stars: r.stargazers_count, url: r.html_url })) : CLUB.sampleRepos;
  } catch { return CLUB.sampleRepos; }
}

export async function Projects() {
  const repos = await getRepos();
  return (
    <section id="projects" className={`${pad} bg-soft`}>
      <div className={wrap}>
        <Head no="05 / projects" title={<>Things we&apos;ve<br />actually shipped.</>}>Live from our GitHub organisation. Star one, fork one, break one.</Head>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {repos.slice(0, 6).map((r, i) => (
            <Reveal as="li" key={r.name} delay={(i % 3) * 0.08}>
              <a href={r.url} target="_blank" rel="noopener" className="flex min-h-[200px] flex-col gap-3.5 rounded-[18px] border border-line bg-white p-[26px] transition duration-300 hover:-translate-y-1.5 hover:border-ink hover:shadow-[0_8px_30px_-12px_rgba(11,11,15,.18)]">
                <h3 className="break-all font-mono text-lg font-bold tracking-tight text-link">{r.name}</h3>
                <p className="flex-1 text-[15.5px] text-ink-2">{r.description || "No description yet — be the first to write one."}</p>
                <div className="flex gap-[18px] font-mono text-[13px] text-ink-3">
                  {r.language && <span className="before:mr-[7px] before:inline-block before:h-2.5 before:w-2.5 before:rounded-full before:bg-node-purple">{r.language}</span>}
                  <span>★ {r.stars}</span>
                </div>
              </a>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Team() {
  const bg = ["bg-node-blue", "bg-node-purple", "bg-node-mint", "bg-brand"];
  return (
    <section id="team" className={pad}>
      <div className={wrap}>
        <Head no="06 / core team" title="The maintainers.">Students like you, who decided to stop waiting and start organising.</Head>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CLUB.team.map((m, i) => (
            <Reveal as="li" key={m.role} delay={i * 0.08} className="group">
              <div className={`grid aspect-square place-items-center overflow-hidden rounded-[18px] border-2 border-ink transition duration-500 group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:-rotate-[1.5deg] group-hover:shadow-[8px_8px_0_#0b0b0f] ${bg[i % 4]}`}>
                {m.handle
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`https://github.com/${m.handle}.png?size=400`} alt={`${m.role} @${m.handle}`} loading="lazy" className="h-full w-full object-cover" />
                  : <svg viewBox="0 0 40 40" className="w-[46%]" fill="none" stroke="#0b0b0f" strokeWidth="3" strokeLinecap="round"><circle cx="20" cy="14" r="7" /><path d="M6 36c1-8 7-12 14-12s13 4 14 12" /></svg>}
              </div>
              <h3 className="mb-1 mt-[18px] text-2xl">{m.role}</h3>
              {m.handle ? <a href={`https://github.com/${m.handle}`} className="font-mono text-[13px] text-link">@{m.handle}</a> : <span className="font-mono text-[13px] text-link">@you-next?</span>}
              <p className="mt-2 text-[15px] text-ink-2">{m.note}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className={pad}>
      <div className={`${wrap} grid items-start gap-[clamp(40px,6vw,100px)] lg:grid-cols-[.9fr_1.3fr]`}>
        <div className="lg:sticky lg:top-28"><Head no="07 / faq" title="Questions, answered." /></div>
        <div>
          {CLUB.faq.map((f) => (
            <details key={f.q} className="group border-b-2 border-ink first:border-t-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-[26px] font-display text-[19px] font-bold tracking-tight sm:text-[23px] [&::-webkit-details-marker]:hidden">
                {f.q}
                <i className="relative h-[22px] w-[22px] flex-none before:absolute before:inset-x-0 before:top-2.5 before:h-[2.5px] before:bg-ink after:absolute after:inset-x-0 after:top-2.5 after:h-[2.5px] after:rotate-90 after:bg-ink after:transition-transform group-open:after:rotate-0" />
              </summary>
              <p className="max-w-[60ch] pb-7 pr-11 text-lg text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className="overflow-hidden border-t-2 border-ink bg-brand py-[clamp(80px,12vw,160px)] text-center">
      <div className={`${wrap} flex flex-col items-center gap-11`}>
        <Reveal><h2 className="text-[clamp(46px,8.5vw,120px)] leading-[.95]">Your first commit<br />is one click away<span className="animate-blink">&gt;_</span></h2></Reveal>
        <a href="#join" className="lift rounded-md border-2 border-ink bg-ink px-11 py-[22px] font-display text-xl font-bold text-white">Join the club</a>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-ink pt-[70px] text-white">
      <div className={`${wrap} flex flex-wrap justify-between gap-10 pb-[60px]`}>
        <div>
          <p className="font-display text-[28px] font-bold tracking-tight">GitHub Community Club <b className="rounded bg-brand px-2 font-black text-ink">BLR</b></p>
          <p className="mt-2.5 text-[#98a29c]">Built by students, for students. Open source, obviously.</p>
        </div>
        <ul className="flex flex-wrap items-start gap-x-[30px] gap-y-3 font-mono text-sm">
          {CLUB.socials.map((s) => <li key={s.label}><a href={s.href} target="_blank" rel="noopener" className="border-b border-transparent text-[#d0d8d3] transition hover:border-brand hover:text-brand">{s.label} ↗</a></li>)}
        </ul>
      </div>
      <div className={`${wrap} flex flex-wrap justify-between gap-3 border-t border-[#23262d] py-[26px] font-mono text-[13.5px] text-[#737a76]`}>
        <span>© {new Date().getFullYear()} GitHub Community Club BLR</span>
        <span>Not officially affiliated with GitHub, Inc.</span>
      </div>
    </footer>
  );
}
