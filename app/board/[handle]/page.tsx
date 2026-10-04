import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, GitMergeIcon, LockIcon, MarkGithubIcon } from "@primer/octicons-react";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Face } from "@/components/site/Team";
import { BadgeChip } from "@/components/site/Badges";
import { ShareButton } from "@/app/events/[slug]/ShareButton";
import { BADGES, badgesByMember } from "@/lib/badges";
import { boardMembers, counted, loadBoard } from "@/lib/board";
import { CHALLENGE, challengeState } from "@/lib/challenge";
import { ago } from "@/lib/issues";
import { SITE_URL } from "@/lib/site";

/* One member's contributions: their badges (and how to earn the rest), and every pull request they got merged
   into someone else's project this club year. Live from GitHub, refreshed hourly like the board. */
export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = () => boardMembers().map((m) => ({ handle: m.handle.toLowerCase() }));

const find = (handle: string) => boardMembers().find((m) => m.handle.toLowerCase() === handle.toLowerCase());
const SHOWN = 20;

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const m = find((await params).handle);
  return m ? { title: `${m.name} on the board`, description: `Pull requests ${m.name} got merged into open-source projects, and the badges they earned.` } : {};
}

export default async function MemberPage({ params }: { params: Promise<{ handle: string }> }) {
  const member = find((await params).handle);
  if (!member) notFound();
  const { prs, members } = await loadBoard();
  const mine = counted(prs, [member]);
  const challenge = CHALLENGE && challengeState(CHALLENGE) !== "upcoming" ? CHALLENGE : undefined;
  const earned = badgesByMember(prs, members, challenge).get(member.handle.toLowerCase()) ?? [];
  const locked = Object.values(BADGES).filter((b) => !earned.some((e) => e.id === b.id) && (b.id !== "challenge" || challenge));
  const repos = new Set(mine.map((p) => p.repo)).size;
  const url = `${SITE_URL}/board/${member.handle.toLowerCase()}`;

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1040px] px-5 pb-24 pt-[120px] md:px-10">
        <Link href="/board" className="mb-8 inline-flex items-center gap-2 text-[14px] text-link hover:underline"><ArrowLeftIcon size={16} />The board</Link>
        <header className="flex flex-wrap items-center gap-5">
          <span className="h-20 w-20 flex-none overflow-hidden rounded-full border-2 border-ink bg-soft"><Face p={member} px={80} i={0} text="text-[26px]" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[clamp(32px,5vw,56px)] leading-[1.02]">{member.name}</h1>
            <a href={`https://github.com/${member.handle}`} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1.5 font-mono text-[14px] text-link hover:underline"><MarkGithubIcon size={14} />@{member.handle}</a>
          </div>
          <ShareButton url={url} title={`${member.name}'s open-source contributions`} />
        </header>

        <dl className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-line bg-line">
          {([["merged", mine.length], ["projects", repos], ["badges", earned.length]] as const).map(([label, n]) => (
            <div key={label} className="flex flex-col gap-1 bg-white px-5 py-4">
              <dt className="text-[13.5px] text-ink-2">{label}</dt>
              <dd className="order-first font-display text-[34px] font-bold leading-none tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-12" aria-labelledby="badges-h">
          <h2 id="badges-h" className="text-[clamp(24px,3vw,32px)]">Badges</h2>
          {earned.length ? <ul className="mt-5 flex flex-wrap gap-2.5">{earned.map((b) => <li key={b.id} title={b.how}><BadgeChip b={b} size="lg" /></li>)}</ul>
            : <p className="mt-3 text-[16px] text-ink-2">No badges yet. The first one comes with the first pull request merged into someone else&apos;s project.</p>}
          {locked.length > 0 && (
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {locked.map((b) => <li key={b.id} className="flex items-start gap-2.5 rounded-[12px] border border-dashed border-line px-4 py-3 text-[14.5px] text-ink-2"><LockIcon size={14} className="mt-1 flex-none text-ink-3" /><span><b className="font-semibold text-ink">{b.name}</b> · {b.how}</span></li>)}
            </ul>
          )}
        </section>

        <section className="mt-12" aria-labelledby="merged-h">
          <h2 id="merged-h" className="text-[clamp(24px,3vw,32px)]">Merged this club year</h2>
          {mine.length ? (
            <ol className="mt-5 divide-y divide-line rounded-[14px] border border-line bg-white">
              {mine.slice(0, SHOWN).map((p) => (
                <li key={p.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <GitMergeIcon size={16} className="mt-1 flex-none text-[#8250df]" />
                  <span className="min-w-0 flex-1">
                    <a href={p.url} target="_blank" rel="noopener" className="block font-semibold leading-snug [overflow-wrap:anywhere] hover:text-link">{p.title}</a>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-ink-3"><span className="font-mono [overflow-wrap:anywhere]">{p.repo}</span><span>{ago(p.merged)}</span></span>
                  </span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 rounded-[14px] border-2 border-dashed border-line p-6 text-[16px] text-ink-2">Nothing merged yet this year. <Link href="/contribute" className="font-semibold text-link hover:underline">Find a first issue</Link>.</p>}
          {mine.length > SHOWN && <p className="mt-3 text-[14px] text-ink-3">and {mine.length - SHOWN} more</p>}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
