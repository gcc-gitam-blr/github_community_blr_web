import type { Metadata } from "next";
import Link from "next/link";
import { CommentIcon, IssueOpenedIcon } from "@primer/octicons-react";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Sticker } from "@/components/ui/Sticker";
import { CLUB } from "@/lib/config";
import { ago, clubIssues, worldIssues, type Issue } from "@/lib/issues";

export const metadata: Metadata = { title: "Contribute", description: "Your first open-source contribution: six steps, plus live beginner-friendly issues from our club and from across GitHub." };
export const revalidate = 1800;

const STEPS = [
  ["Fork", "Click Fork on the project's GitHub page. You get your own copy to experiment in."],
  ["Clone", "git clone <your-fork-url> — download your copy to your computer."],
  ["Branch", "git switch -c fix-typo — a branch keeps your change separate and tidy."],
  ["Change & commit", "Make your edit, then git add . and git commit -m \"Fix typo in README\"."],
  ["Push", "git push origin fix-typo — send your branch to your fork on GitHub."],
  ["Open a pull request", "GitHub shows a green “Compare & pull request” button. Describe what you changed and why. Done!"],
];

function IssueList({ issues, empty }: { issues: Issue[]; empty: string }) {
  if (!issues.length) return <p className="rounded-[14px] border border-dashed border-line p-6 text-[16px] text-ink-2">{empty}</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {issues.map((i) => (
        <li key={i.id}>
          <a href={i.url} target="_blank" rel="noopener" className="group flex h-full flex-col rounded-[14px] border border-line bg-white p-4 transition hover:border-ink">
            <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-ink-3"><IssueOpenedIcon size={14} className="shrink-0 text-[#1a7f37]" /><span className="min-w-0 [overflow-wrap:anywhere]">{i.repo}</span></span>
            <span className="mt-1.5 text-[17px] font-semibold leading-snug [overflow-wrap:anywhere] group-hover:text-link">{i.title}</span>
            <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-[13px] text-ink-3">
              <span>updated {ago(i.updated)}</span>
              <span className="inline-flex items-center gap-1"><CommentIcon size={13} />{i.comments}</span>
              {i.labels.filter((l) => l.toLowerCase() !== "good first issue").slice(0, 2).map((l) => <span key={l} className="rounded-full bg-soft px-2 py-0.5 text-[12px]">{l}</span>)}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function Contribute() {
  const [club, world] = await Promise.all([clubIssues(), worldIssues()]);
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-[130px] md:px-[clamp(20px,5vw,72px)]">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-[760px]">
            <p className="font-mono text-[13px] text-ink-2">{"// contribute"}</p>
            <h1 className="mt-4 text-[clamp(40px,6.4vw,84px)]">Your first open-source<br />contribution.</h1>
            <p className="mt-5 max-w-[56ch] text-[19px] text-ink-2">Open source is software anyone can improve — and you can start today. Fixing a typo counts. Here&apos;s how, and where to find something your size.</p>
          </div>
          <Sticker name="jetpack" size={150} tilt={-6} className="mb-4 hidden md:block" alt="" />
        </div>

        <section className="mt-16" aria-labelledby="steps">
          <h2 id="steps" className="text-[clamp(30px,4vw,48px)]">Six steps</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="rounded-[16px] border border-line bg-white p-5">
                <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-ink font-mono text-[13px] font-bold" style={{ background: ["#b9e0f7", "#d9c8f7", "#bfeedd"][i % 3] }}>{i + 1}</span>
                <h3 className="mt-3 text-[20px]">{t}</h3>
                <p className="mt-1.5 text-[15.5px] leading-snug text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {CLUB.githubOrg && (
          <section className="mt-20" aria-labelledby="ours">
            <h2 id="ours" className="text-[clamp(30px,4vw,48px)]">Issues in our club&apos;s projects</h2>
            <p className="mb-6 mt-3 text-[17px] text-ink-2">Open “good first issue”s in <a className="text-link underline" href={`${CLUB.githubUrl}/${CLUB.githubOrg}`} target="_blank" rel="noopener">{CLUB.githubOrg}</a> — with club members to help you.</p>
            <IssueList issues={club} empty="No open beginner issues in our projects right now. Pick one from the list below, or ask in the WhatsApp community and we'll find you one." />
          </section>
        )}

        <section className="mt-20" aria-labelledby="world">
          <h2 id="world" className="text-[clamp(30px,4vw,48px)]">Fresh beginner issues across GitHub</h2>
          <p className="mb-6 mt-3 max-w-[64ch] text-[17px] text-ink-2">Live from GitHub: recent “good first issue”s nobody has commented on yet. Read the project&apos;s README and contributing guide first, then say hello in the issue before you start.</p>
          <IssueList issues={world} empty="GitHub's search is busy right now — try goodfirstissue.dev or the First Contributions project on the Learn page." />
        </section>

        <div className="mt-20 rounded-[18px] border-2 border-ink bg-[#dafbe1] p-6 sm:flex sm:items-center sm:justify-between sm:p-8">
          <p className="max-w-[56ch] text-[18px]"><b>Stuck, or nervous about your first PR?</b> Come to a session — mentors review your first pull request with you. New to Git? Start with the <Link href="/learn" className="font-semibold text-link underline">Learn hub</Link>.</p>
          <Link href="/#join" className="press mt-4 inline-flex rounded-md bg-ink px-5 py-3 font-display font-bold text-white sm:mt-0">Join the club</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
