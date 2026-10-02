import Link from "next/link";
import { CLUB } from "@/lib/config";
import { Reveal } from "@/components/ui/Reveal";
import { EventsYear } from "./EventsYear";
import { FaqIssues } from "./FaqIssues";
import { LearnPath } from "./LearnPath";
import { StickerLid } from "./StickerLid";
import { Sticker } from "@/components/ui/Sticker";
import { SocialLinks } from "./SocialLinks";
import { JoinCard } from "./JoinCard";
import { UpdateTag } from "./UpdateTag";
import { getUpdates, updateDate } from "@/lib/updates";

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
          <Head tag="// about the club" title={<>A community that <em className="hl">commits</em> to each other.</>}>
            We&apos;re the GitHub Community Club at GITAM University Bengaluru — students helping students learn the tools real software teams use. You don&apos;t need any experience: we start from the basics and build up together.
          </Head>
          <Reveal delay={0.1}>
            <p className="mb-4 font-mono text-[13px] text-ink-2">What we do</p>
            <ul className="grid gap-3">
              {CLUB.whatWeDo.map((w, i) => (
                <li key={w.title} className="flex gap-4 rounded-[14px] border border-line bg-white p-4">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-full border-2 border-ink font-mono text-[13px] font-bold" style={{ background: ["#b9e0f7", "#d9c8f7", "#bfeedd"][i] }}>{String(i + 1).padStart(2, "0")}</span>
                  <div><h3 className="text-[19px]">{w.title}</h3><p className="mt-1 text-[15.5px] leading-snug text-ink-2">{w.text}</p></div>
                </li>
              ))}
            </ul>
          </Reveal>
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
        <p className="mt-12 flex flex-wrap gap-x-8 gap-y-2 text-[17px]"><Link href="/learn" className="font-semibold text-link hover:underline">Free resources &amp; a Git cheat sheet →</Link><Link href="/contribute" className="font-semibold text-link hover:underline">Find a beginner-friendly issue →</Link></p>
      </div>
    </section>
  );
}

/** The two newest posts from content/updates, under the calendar. */
function LatestUpdates() {
  const posts = getUpdates().slice(0, 2);
  if (!posts.length) return null;
  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <h3 className="font-mono text-[13px] font-normal text-ink-3">{"// latest updates"}</h3>
        <Link href="/updates" className="text-[14.5px] font-semibold text-link hover:underline">All updates →</Link>
      </div>
      <ul className="grid md:grid-cols-2 md:gap-8">
        {posts.map((p) => (
          <li key={p.slug} className="border-b border-line py-5 md:border-0">
            <p className="flex items-center gap-3 text-[13.5px] text-ink-2"><time dateTime={p.date}>{updateDate(p.date)}</time><UpdateTag tag={p.tag} /></p>
            <Link href={`/updates/${p.slug}`} className="mt-2 block font-display text-[21px] font-bold leading-snug hover:underline hover:underline-offset-4">{p.title}</Link>
            <p className="mt-1.5 text-[15.5px] leading-relaxed text-ink-2">{p.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Events() {
  return (
    <section id="events" className={pad}>
      <div className={wrap}>
        <Head tag="// events · 2026-27" title={<>The year, as a<br />contribution graph.</>}>Every event is a green square. December is gold — that&apos;s Epoch. Pick a day to see what&apos;s on.</Head>
        <EventsYear />
        <LatestUpdates />
        {CLUB.lumaCalendar && <a href={CLUB.lumaCalendar} target="_blank" rel="noopener" className="mt-6 inline-flex items-center gap-2 font-semibold text-link hover:underline">See every event and RSVP on Luma ↗</a>}
        {CLUB.lumaEpochCalendar && <a href={CLUB.lumaEpochCalendar} target="_blank" rel="noopener" className="ml-6 mt-6 inline-flex items-center gap-2 font-semibold text-link hover:underline">Epoch on Luma ↗</a>}
      </div>
    </section>
  );
}

interface Repo { name: string; description: string | null; language: string | null; stars: number; url: string }

/** Live from the club's GitHub organisation. Returns [] when no org is configured, so the section is not shown at all. */
async function getRepos(): Promise<Repo[]> {
  if (!CLUB.githubOrg) return [];
  try {
    const res = await fetch(`https://api.github.com/orgs/${CLUB.githubOrg}/repos?sort=updated&per_page=30`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const j = (await res.json()) as { name: string; description: string | null; language: string | null; stargazers_count: number; html_url: string; fork: boolean; archived: boolean }[];
    // real projects only: no forks, archived repos or the org's .github settings repo
    return j.filter((r) => !r.fork && !r.archived && !r.name.startsWith(".")).map((r) => ({ name: r.name, description: r.description, language: r.language, stars: r.stargazers_count, url: r.html_url }));
  } catch { return []; }
}

export async function Projects() {
  const repos = await getRepos();
  if (!repos.length) return null;
  return (
    <section id="projects" className={`${pad} bg-soft`}>
      <div className={wrap}>
        <Head tag="// projects" title={<>Things we&apos;ve<br />actually shipped.</>}>Live from our GitHub organisation — the most recently updated. Star one, fork one, open a pull request.</Head>
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
        <a href={`${CLUB.githubUrl}/${CLUB.githubOrg}`} target="_blank" rel="noopener" className="mt-8 inline-flex items-center gap-2 font-semibold text-link hover:underline">See all our repositories on GitHub →</a>
      </div>
    </section>
  );
}

type Member = (typeof CLUB.team)[number];
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const NODE_BG = ["bg-node-blue", "bg-node-purple", "bg-node-mint", "bg-brand"];

/** A face: their photo, else their GitHub avatar, else a neutral silhouette. */
function Face({ m, size }: { m: Member; size: "card" | "chip" }) {
  if (m.photo) {
    const sm = m.photo.replace(/\.webp$/, "-sm.webp");
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.photo} srcSet={`${sm} 240w, ${m.photo} 480w`} sizes={size === "card" ? "(min-width: 1024px) 220px, 45vw" : "48px"} alt="" width={480} height={480} loading="lazy" className="h-full w-full object-cover" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  if (m.handle) return <img src={`https://github.com/${m.handle}.png?size=${size === "card" ? 400 : 160}`} alt="" loading="lazy" className="h-full w-full object-cover" />;
  return <span className={`font-display font-black tracking-tight text-ink/80 ${size === "card" ? "text-[clamp(40px,5vw,60px)]" : "text-[26px]"}`} aria-hidden>{initials(m.name)}</span>;
}

/** One group of the team as equal cards: a face, a name, a role. */
function People({ title, note, people, offset = 0 }: { title: string; note: string; people: Member[]; offset?: number }) {
  if (!people.length) return null;
  return (
    <div className="mt-10 first:mt-0">
      <p className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-display text-[18px] font-bold">{title}</span><span className="font-mono text-[13px] text-ink-3">{note}</span></p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
        {people.map((m, i) => (
          <Reveal as="li" key={m.name} delay={(i % 6) * 0.05}>
            <div className={`lift grid aspect-square place-items-center overflow-hidden rounded-[18px] border-2 border-ink ${m.photo || m.handle ? "bg-soft" : NODE_BG[(i + offset) % NODE_BG.length]}`}><Face m={m} size="card" /></div>
            <h4 className="mb-1.5 mt-4 text-[20px] leading-tight">{m.name}</h4>
            <p className="inline-block rounded-md border border-line px-2 py-0.5 text-[12.5px] font-semibold leading-snug text-ink-2">{m.role}</p>
            {m.handle && <a href={`https://github.com/${m.handle}`} target="_blank" rel="noopener" className="mt-1 block font-mono text-[13px] text-link hover:underline">@{m.handle}</a>}
          </Reveal>
        ))}
      </ul>
    </div>
  );
}

/** The people running the club: mentors, then the core team and technical staff as equal cards, then who built this site. */
export function Team() {
  const mentors = CLUB.team.filter((m) => m.group === "mentor"), leads = CLUB.team.filter((m) => m.group === "lead"), tech = CLUB.team.filter((m) => m.group === "tech");
  if (!CLUB.team.length) return null;
  return (
    <section id="team" className={pad}>
      <div className={wrap}>
        <Head tag={`// core team · ${CLUB.year}`} title="The maintainers.">Students like you, who decided to stop waiting and start organising. <Link href="/get-involved?kind=apply" className="font-semibold text-link hover:underline">Want to join them?</Link></Head>
        {mentors.length > 0 && (
          <Reveal className="mb-12">
            <p className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-display text-[18px] font-bold">Mentors</span><span className="font-mono text-[13px] text-ink-3">org owners · direction, policy and mentoring</span></p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {mentors.map((m, i) => (
                <li key={m.name} className="flex items-center gap-4 rounded-[16px] border-2 border-ink bg-white p-4">
                  <span className={`grid h-[72px] w-[72px] flex-none place-items-center overflow-hidden rounded-[14px] border-2 border-ink ${m.photo || m.handle ? "bg-soft" : NODE_BG[(i + 2) % NODE_BG.length]}`}><Face m={m} size="chip" /></span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-display text-[20px] font-bold leading-tight">{m.name}</span><span className="rounded-full border border-[#d4a72c] bg-[#fff8c5] px-2 py-px text-[11.5px] font-semibold text-[#7d4e00]">Owner</span></span>
                    <span className="mt-1 block text-[14.5px] font-medium text-ink-2">{m.role}</span>
                    {(m.past || m.handle) && <span className="mt-0.5 block text-[13px] text-ink-3">{m.past}{m.past && m.handle ? " · " : ""}{m.handle && <a href={`https://github.com/${m.handle}`} target="_blank" rel="noopener" className="font-mono text-link hover:underline">@{m.handle}</a>}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
        <People title="Core team" note="runs the club" people={leads} />
        <People title="Technical staff" note="builds the club's projects and workshops" people={tech} offset={leads.length} />

        {CLUB.contributors.length > 0 && (
          <Reveal className="mt-14 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[16px] border border-line bg-white p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-[18px]">Contributors <span className="rounded-full bg-soft px-2 py-0.5 font-sans text-[12.5px] font-semibold text-ink-2">{CLUB.contributors.length}</span></h3>
            <ul className="flex flex-wrap gap-2">
              {CLUB.contributors.map((c, i) => {
                const inner = (<>
                  <span className={`grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full ${c.handle ? "bg-soft" : NODE_BG[i % NODE_BG.length]}`} aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.handle ? <img src={`https://github.com/${c.handle}.png?size=56`} alt="" width={28} height={28} loading="lazy" /> : <span className="text-[11px] font-bold">{initials(c.name)}</span>}
                  </span>
                  {c.name}
                </>);
                const cls = "inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3.5 text-[14.5px] font-medium";
                return <li key={c.name}>{c.handle ? <a href={`https://github.com/${c.handle}`} target="_blank" rel="noopener" className={`${cls} transition-colors duration-150 hover:border-ink/40`}>{inner}</a> : <span className={cls}>{inner}</span>}</li>;
              })}
            </ul>
            <p className="font-mono text-[13px] text-ink-3">built this website</p>
          </Reveal>
        )}
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
          {CLUB.joinUrl && <a href={CLUB.joinUrl} target="_blank" rel="noopener" className="press lift mt-8 inline-flex items-center gap-2 rounded-md border-2 border-ink bg-white px-5 py-3 font-display font-bold">Join the WhatsApp community →</a>}
          <div className="mt-8"><p className="mb-3 font-mono text-[13px] text-ink">Follow us for event updates:</p><SocialLinks /></div>
          <Sticker name="welcome" size={170} tilt={-5} className="mt-8 hidden lg:block" alt="" />
        </Reveal>
        <Reveal delay={0.1}><JoinCard /></Reveal>
      </div>
    </section>
  );
}
