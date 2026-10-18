import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JourneyRail, NextBand } from "@/components/site/Journey";
import { Sticker } from "@/components/ui/Sticker";
import { CLUB } from "@/lib/config";
import { IDEA_STATUS, domainLabel, type IdeaStatus } from "@/lib/projects";
import { serverDb } from "@/lib/supabase-server";

/* /projects: what club members have built together. Only projects the core team has reviewed and featured appear here
   (the database decides: public_projects in supabase/schema.sql), and a member's GitHub name is shown only if they agreed.
   Without the database, or before the first project is featured, the page says so instead of showing anything made up. */
export const revalidate = 300;

interface Featured { id: number; title: string; summary: string; domains: string[]; skills: string[]; status: IdeaStatus; repo_url: string | null; club: boolean; team_count: number; people: string[] }
async function featured(): Promise<Featured[]> {
  const db = serverDb();
  if (!db) return [];
  try {
    const { data, error } = await db.rpc("public_projects");
    return error || !Array.isArray(data) ? [] : (data as Featured[]);
  } catch { return []; }
}

export async function generateMetadata(): Promise<Metadata> {
  const n = (await featured()).length;
  return { title: "Projects", description: "What members of the GitHub Community Club have built together.", robots: n ? undefined : { index: false, follow: true } };
}

export default async function Projects() {
  const list = await featured();
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-[130px] md:px-[clamp(20px,5vw,72px)]">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[13px] text-ink-2">{"// git log --oneline projects/"}</p>
            <h1 className="mt-4 text-[clamp(40px,6.4vw,76px)]">Built together.</h1>
            <p className="mt-5 max-w-[56ch] text-[19px] text-ink-2">Projects made by members of the club, from the first idea to something people use. Every one was reviewed by the core team before it appeared here.</p>
          </div>
          <Sticker name="coder" size={150} tilt={-4} className="mb-2 hidden md:block" alt="" />
        </div>
        <JourneyRail at="projects" />

        {list.length === 0 ? (
          <div className="mt-12 max-w-[640px] rounded-[18px] border border-line bg-white p-6 sm:p-8">
            <h2 className="text-[26px]">Our first member projects are on their way.</h2>
            <p className="mt-3 text-[17px] text-ink-2">Members are choosing what to build together right now. When a team has something to show, it appears here.</p>
            <Link href="/hub" className="mt-6 inline-block font-semibold text-link hover:underline">Members: share an idea or find your team →</Link>
          </div>
        ) : (
          <>
            <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => {
                const others = p.team_count - p.people.length;
                return (
                  <li key={p.id} className="flex min-h-[220px] flex-col gap-3.5 rounded-[18px] border border-line bg-white p-[26px]">
                    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[12.5px]">{IDEA_STATUS[p.status] ?? p.status}</span>{p.club && <span className="rounded-full bg-[#dafbe1] px-2.5 py-0.5 text-[12.5px] font-semibold text-[#116329]">Club project</span>}</div>
                    <h2 className="text-[22px] leading-snug">{p.title}</h2>
                    <p className="flex-1 text-[15.5px] text-ink-2">{p.summary}</p>
                    <ul className="flex flex-wrap gap-1.5">{p.domains.map((d) => <li key={d} className="rounded-full bg-soft px-2.5 py-0.5 font-mono text-[12.5px] text-ink-2">{domainLabel(d)}</li>)}</ul>
                    <p className="text-[14px] text-ink-3">
                      Built by {p.people.length ? p.people.map((h, i) => <span key={h}>{i ? ", " : ""}<a href={`https://github.com/${h}`} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">@{h}</a></span>) : null}
                      {others > 0 ? `${p.people.length ? " and " : ""}${others} ${others === 1 ? "member" : "members"}` : ""}
                      {p.repo_url && <> · <a href={p.repo_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-link hover:underline">Repository →</a></>}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-10 text-[16px] text-ink-2">Want to build the next one? <Link href="/hub" className="font-semibold text-link hover:underline">Open the project hub →</Link>{CLUB.githubOrg ? <> Or see everything we&apos;ve shipped on <a href={`${CLUB.githubUrl}/${CLUB.githubOrg}`} target="_blank" rel="noopener" className="font-semibold text-link hover:underline">GitHub</a>.</> : null}</p>
          </>
        )}
      </main>
      <NextBand cmd="git checkout -b your-idea" title={<>Your idea<br />could be next.</>} text="Members post ideas, find teammates by skill, and the core team features the best of them here." href="/hub" cta="Open the project hub" second={{ href: "/join", label: "Not a member yet? Join the club" }} tone="ink" />
      <SiteFooter />
    </>
  );
}
