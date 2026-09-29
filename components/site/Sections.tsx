import { CLUB } from "@/lib/config";
import { Reveal } from "@/components/ui/Reveal";
import { DiffStat } from "./DiffStat";
import { EventsYear } from "./EventsYear";
import { FaqIssues } from "./FaqIssues";
import { LearnPath } from "./LearnPath";
import { StickerLid } from "./StickerLid";
import { Sticker } from "@/components/ui/Sticker";
import { JoinCard } from "./JoinCard";

export function Head({ tag, title, children, light = false }: { tag: string; title: React.ReactNode; children?: React.ReactNode; light?: boolean }) {
  return (
    <Reveal className="mb-[clamp(36px,5vw,60px)] max-w-[760px]">
      <span className={`font-mono text-[13px] ${light ? "text-brand" : "text-ink-2"}`}>{tag}</span>
      <h2 className="mt-4 text-[clamp(38px,5.6vw,68px)]">{title}</h2>
      {children && <p className={`mt-5 max-w-[58ch] text-[19px] ${light ? "text-[#a9b3ad]" : "text-ink-2"}`}>{children}</p>}
    </Reveal>
  );
}
const pad = "py-[clamp(64px,8vw,112px)]";
const wrap = "mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]";

export function About() {
  return (
    <section id="about" className={pad}>
      <div className={`${wrap} grid grid-cols-[minmax(0,1fr)] items-center gap-[clamp(36px,6vw,88px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
        <div>
          <Head tag="// about" title={<>A community that <em className="hl">commits</em> to each other.</>}>
            The GitHub Community Club at GITAM University Bengaluru exists for one reason: nobody should learn to code alone. Six events this year — from your first pull request to a full-scale technical month, Epoch — with a crew that helps every newcomer ship.
          </Head>
          <Reveal delay={0.1}><DiffStat /></Reveal>
        </div>
        <Reveal delay={0.1}><StickerLid /></Reveal>
      </div>
    </section>
  );
}

/* Everything here comes from the Plan of Action's workshops and the club calendar. */
export function Learn() {
  return (
    <section id="learn" className={`${pad} bg-soft`}>
      <div className={wrap}>
        <div className="flex items-end justify-between gap-6">
          <Head tag="// what you'll learn" title={<>One branch,<br />six commits.</>}>Start at <code className="font-mono text-[.9em]">git init</code>, finish with something you can tag and show. Every session in the year moves you one commit along.</Head>
          <Sticker name="professor" size={150} tilt={6} className="mb-12 hidden md:block" alt="" />
        </div>
        <LearnPath />
      </div>
    </section>
  );
}

export function Events() {
  return (
    <section id="events" className={pad}>
      <div className={wrap}>
        <Head tag="// events · 2026-27" title={<>The year, as a<br />contribution graph.</>}>Every event is a green square. December is gold — that&apos;s Epoch. Pick a day to see what&apos;s on.</Head>
        <EventsYear />
      </div>
    </section>
  );
}

interface Repo { name: string; description: string | null; language: string | null; stars: number; url: string }

/** Live from the club's GitHub organisation. Returns [] when no org is configured, so the section is not shown at all. */
async function getRepos(): Promise<Repo[]> {
  if (!CLUB.githubOrg) return [];
  try {
    const res = await fetch(`https://api.github.com/orgs/${CLUB.githubOrg}/repos?sort=updated&per_page=6`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const j = (await res.json()) as { name: string; description: string | null; language: string | null; stargazers_count: number; html_url: string }[];
    return j.map((r) => ({ name: r.name, description: r.description, language: r.language, stars: r.stargazers_count, url: r.html_url }));
  } catch { return []; }
}

export async function Projects() {
  const repos = await getRepos();
  if (!repos.length) return null;
  return (
    <section id="projects" className={`${pad} bg-soft`}>
      <div className={wrap}>
        <Head tag="// projects" title={<>Things we&apos;ve<br />actually shipped.</>}>Live from our GitHub organisation. Star one, fork one, break one.</Head>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {repos.slice(0, 6).map((r, i) => (
            <Reveal as="li" key={r.name} delay={(i % 3) * 0.08}>
              <a href={r.url} target="_blank" rel="noopener" className="flex min-h-[200px] flex-col gap-3.5 rounded-[18px] border border-line bg-white p-[26px] transition duration-300 hover:-translate-y-1.5 hover:border-ink hover:shadow-[0_8px_30px_-12px_rgba(11,11,15,.18)]">
                <h3 className="break-all font-mono text-lg font-bold tracking-tight text-link">{r.name}</h3>
                <p className="flex-1 text-[15.5px] text-ink-2">{r.description || "No description yet."}</p>
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

/** Only rendered once real people are added to CLUB.team. */
export function Team() {
  if (!CLUB.team.length) return null;
  const bg = ["bg-node-blue", "bg-node-purple", "bg-node-mint", "bg-brand"];
  return (
    <section id="team" className={pad}>
      <div className={wrap}>
        <Head tag="// core team" title="The maintainers.">Students like you, who decided to stop waiting and start organising.</Head>
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
              {m.handle && <a href={`https://github.com/${m.handle}`} className="font-mono text-[13px] text-link">@{m.handle}</a>}
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
    <section id="faq" className={`${pad} bg-soft`}>
      <div className={`${wrap} grid grid-cols-[minmax(0,1fr)] items-start gap-[clamp(36px,6vw,88px)] lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.4fr)]`}>
        <div className="lg:sticky lg:top-28">
          <Head tag="// faq" title="Questions, answered.">Closed issues from people who asked before you.</Head>
          <Sticker name="support" size={130} tilt={-6} className="hidden lg:block" alt="" />
        </div>
        <Reveal><FaqIssues /></Reveal>
      </div>
    </section>
  );
}

/* The one place to join: headline on the left, the form on the right. */
export function Join() {
  return (
    <section id="join" className="overflow-hidden border-t-2 border-ink bg-brand py-[clamp(64px,9vw,120px)]">
      <div className={`${wrap} grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]`}>
        <Reveal>
          <h2 className="text-[clamp(44px,6.6vw,96px)] leading-[.95]">Your first commit is one click away<span className="animate-blink">&gt;_</span></h2>
          <p className="mt-6 max-w-[40ch] text-[19px] text-ink/80">Open a pull request into the club: who you are, and what you want to try first. We&apos;ll review it with a welcome.</p>
          <Sticker name="welcome" size={170} tilt={-5} className="mt-8 hidden lg:block" alt="" />
        </Reveal>
        <Reveal delay={0.1}><JoinCard /></Reveal>
      </div>
    </section>
  );
}
