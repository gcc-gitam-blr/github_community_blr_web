import type { Metadata } from "next";
import Link from "next/link";
import { GitMergeIcon, RepoIcon } from "@primer/octicons-react";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Face } from "@/components/site/Team";
import { Sticker } from "@/components/ui/Sticker";
import { Challenge } from "@/components/site/Challenge";
import { ago } from "@/lib/issues";
import { BOARD_SINCE, SHOW_SAMPLE, loadBoard, sampleBoard, type MergedPr, type Row } from "@/lib/board";
import { badgesByMember, type Badge } from "@/lib/badges";
import { BadgeRow } from "@/components/site/Badges";
import { CHALLENGE, challengeProgress, challengeState, sampleChallenge } from "@/lib/challenge";

export const metadata: Metadata = { title: "Board", description: "Pull requests club members got merged into open-source projects this year, live from GitHub." };
export const revalidate = 3600;

const since = new Date(BOARD_SINCE + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const TOP = 12; // the rest are summarised as faces, so the page never turns into a long list

function RowItem({ r, i, badges }: { r: Row; i: number; badges: Badge[] }) {
  return (
    <li className="flex items-center gap-4 px-4 py-4 sm:px-5">
      <span className="w-6 shrink-0 text-right font-mono text-[13px] text-ink-3">{i + 1}</span>
      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-line bg-soft"><Face p={r.member} px={44} i={i} text="text-[15px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/board/${r.member.handle}`} className="font-semibold hover:text-link">{r.member.name}</Link>
          <a href={`https://github.com/${r.member.handle}`} target="_blank" rel="noopener" className="font-mono text-[13px] text-link hover:underline">@{r.member.handle}</a>
        </span>
        <a href={r.latest.url} target="_blank" rel="noopener" className="mt-0.5 block truncate text-[14px] text-ink-2 hover:text-link" title={r.latest.title}>Latest: {r.latest.title} <span className="text-ink-3">· {r.latest.repo}</span></a>
        <BadgeRow badges={badges} />
      </span>
      <span className="shrink-0 text-right">
        <span className="inline-flex items-center gap-1.5 font-display text-[22px] font-bold tabular-nums leading-none"><GitMergeIcon size={16} className="text-[#8250df]" />{r.prs}</span>
        <span className="mt-1 block text-[12.5px] text-ink-3">{r.repos.length} {r.repos.length === 1 ? "repo" : "repos"}</span>
      </span>
    </li>
  );
}

function Recent({ prs }: { prs: MergedPr[] }) {
  return (
    <ol className="relative ml-2 border-l-2 border-line">
      {prs.map((p) => (
        <li key={p.id} className="relative pb-5 pl-6 last:pb-0">
          <span className="absolute -left-[11px] top-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#8250df] text-white"><GitMergeIcon size={12} /></span>
          <a href={p.url} target="_blank" rel="noopener" className="block text-[15px] font-semibold leading-snug hover:text-link">{p.title}</a>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-3">
            <span className="font-mono">@{p.author}</span>
            <span className="inline-flex min-w-0 items-center gap-1 break-all"><RepoIcon size={12} className="shrink-0" />{p.repo}</span>
            <span>{ago(p.merged)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function Board() {
  const live = await loadBoard();
  const sample = SHOW_SAMPLE && !live.rows.length;
  const now = new Date();
  const { ok, members, prs, rows, recent } = sample ? { ...live, ...sampleBoard(now) } : live;
  const top = rows.slice(0, TOP), more = rows.slice(TOP);
  // the sample board gets a sample challenge; real merges are only ever measured against the real one
  const challenge = sample ? sampleChallenge(now) : CHALLENGE, state = challenge && challengeState(challenge, now);
  const badges = badgesByMember(prs, members, challenge && state !== "upcoming" ? challenge : undefined);
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-[130px] md:px-[clamp(20px,5vw,72px)]">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-[760px]">
            <p className="font-mono text-[13px] text-ink-2">{"// git log --merges --author=club"}</p>
            <h1 className="mt-4 text-[clamp(40px,6.4vw,84px)]">Merged by<br />members.</h1>
            <p className="mt-5 max-w-[56ch] text-[19px] text-ink-2">Pull requests club members got merged into other people&apos;s projects since {since}. A typo fix counts. Straight from GitHub, refreshed every hour.</p>
          </div>
          <Sticker name="maker" size={150} tilt={6} className="mb-4 hidden md:block" alt="" />
        </div>

        {sample && <p className="mt-10 rounded-lg border border-[#d4a72c66] bg-[#fff8c5] px-4 py-3 text-[15px] text-[#7d4e00]">Sample board and challenge, with GitHub&apos;s mascot accounts: shown on preview deployments only while no member has a merge, never on the live site.</p>}
        {!ok && <p role="status" className="mt-10 rounded-lg border border-[#d4a72c66] bg-[#fff8c5] px-4 py-3 text-[15px] text-[#7d4e00]">GitHub didn&apos;t answer every request just now, so the board may be missing a few people. It refreshes within the hour.</p>}

        {challenge && (state === "on" || state === "finished") && <Challenge c={challenge} state={state} now={now} sample={sample} {...challengeProgress(prs, members, challenge)} />}

        {rows.length ? (
          <div className="mt-14 grid items-start gap-10 lg:grid-cols-[1fr_360px]">
            <section aria-labelledby="ranks" className="min-w-0">
              <h2 id="ranks" className="text-[clamp(26px,3.4vw,40px)]">Contributors</h2>
              <ol className="mt-6 divide-y divide-line rounded-[14px] border border-line bg-white">{top.map((r, i) => <RowItem key={r.member.handle} r={r} i={i} badges={badges.get(r.member.handle.toLowerCase()) ?? []} />)}</ol>
              {more.length > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex -space-x-2">{more.slice(0, 8).map((r, i) => <span key={r.member.handle} title={`${r.member.name}: ${r.prs} merged`} className="h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-soft"><Face p={r.member} px={32} i={i + TOP} text="text-[11px]" /></span>)}</span>
                  <span className="text-[14px] text-ink-2">and {more.length} more with merged pull requests</span>
                </div>
              )}
            </section>
            <section aria-labelledby="recent" className="min-w-0 lg:pt-1">
              <h2 id="recent" className="text-[clamp(22px,2.6vw,28px)]">Recently merged</h2>
              <div className="mt-6"><Recent prs={recent} /></div>
            </section>
          </div>
        ) : (
          <div className="mt-14 rounded-[18px] border-2 border-dashed border-line p-8 text-center sm:p-12">
            <GitMergeIcon size={32} className="mx-auto text-[#8250df]" />
            <h2 className="mt-4 text-[clamp(24px,3vw,34px)]">No merged pull requests yet this year.</h2>
            <p className="mx-auto mt-3 max-w-[48ch] text-[17px] text-ink-2">The first one gets the top spot. Find an issue your size and open a pull request.</p>
            <Link href="/contribute" className="press mt-6 inline-flex rounded-md bg-ink px-5 py-3 font-display font-bold text-white">Find a first issue</Link>
          </div>
        )}

        <p className="mt-16 max-w-[64ch] text-[15px] text-ink-2">
          The board follows the {members.length} members whose GitHub handle is on the site. Not on it? Ask a lead to add your handle to the team or contributors list.
          Pull requests into your own repositories don&apos;t count; this is about contributing to projects that aren&apos;t yours.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
