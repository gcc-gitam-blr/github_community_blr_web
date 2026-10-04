"use client";
import Link from "next/link";
import { ThemeChoices } from "@/components/ui/ThemeToggle";
import { ArrowUpRightIcon, CalendarIcon, ChevronUpIcon, DotFillIcon, MailIcon, MarkGithubIcon } from "@primer/octicons-react";
import { CLUB } from "@/lib/config";
import { EPOCH } from "@/lib/epoch/config";
import { Sticker } from "@/components/ui/Sticker";
import { scrollToTarget } from "@/components/ui/SmoothScroll";
import { useClientValue } from "@/lib/useClientValue";
import { SocialLinks } from "./SocialLinks";
import gallery from "@/lib/gallery.json";
import { MEMORIES_LINKED } from "@/lib/memories";

/* One footer for the whole site (club pages and Epoch). Links are only shown when they lead somewhere real. */
const COMMIT = process.env.NEXT_PUBLIC_COMMIT_SHA ?? ""; // set at build time from Vercel (next.config.ts)
const ORG = CLUB.githubOrg ? `${CLUB.githubUrl}/${CLUB.githubOrg}` : "";

type L = { label: string; href: string; ext?: boolean };
const COLUMNS: { title: string; links: L[] }[] = [
  { title: "Club", links: [{ label: "About", href: "/#about" }, { label: "What you'll learn", href: "/#learn" }, { label: "Learn hub", href: "/learn" }, { label: "Contribute", href: "/contribute" }, { label: "Board", href: "/board" }, { label: "My club", href: "/me" }, { label: "Get involved", href: "/get-involved" }, { label: "Updates", href: "/updates" }, { label: "Events 2026-27", href: "/#events" }, { label: "Team", href: "/#team" }, ...(MEMORIES_LINKED ? [{ label: "Memories", href: "/memories" }] : []), ...(gallery.length ? [{ label: "Gallery", href: "/#gallery" }] : []), { label: "FAQ", href: "/#faq" }, { label: "Join the club", href: "/#join" }] },
  { title: "Epoch", links: [{ label: "Overview", href: "/epoch" }, { label: "How coins work", href: "/epoch#ticket" }, { label: "Booths", href: "/epoch/booths" }, { label: "The plan", href: "/epoch#plan" }, { label: "Merch shop", href: "/epoch/shop" }, { label: "Leaderboard", href: "/epoch/leaderboard" }, { label: "Guide for the day", href: "/epoch/guide" }] },
  { title: "Learn on GitHub", links: [{ label: "GitHub Skills", href: "https://skills.github.com", ext: true }, { label: "GitHub Docs", href: "https://docs.github.com", ext: true }, { label: "Student Developer Pack", href: "https://education.github.com/pack", ext: true }, { label: "GitHub Community", href: "https://github.com/community", ext: true }] },
  { title: "Get involved", links: [
    { label: "My Epoch wallet", href: "/epoch/wallet" },
    { label: "Club admin", href: "/admin" },
    ...(ORG ? [{ label: "Contribute to this site", href: ORG, ext: true }] : []),
    ...(CLUB.email ? [{ label: "Email the club", href: `mailto:${CLUB.email}`, ext: true }] : []),
    ...CLUB.socials.filter((s) => s.href && s.href !== "#").map((s) => ({ label: s.label, href: s.href, ext: true })),
  ] },
];

function nextUpLine() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = [...CLUB.events].sort((a, b) => a.date.localeCompare(b.date)).find((e) => new Date(e.date + "T00:00:00") >= today);
  if (!next) return "That's a wrap for this year — see you next year.";
  const d = Math.round((new Date(next.date + "T00:00:00").getTime() - today.getTime()) / 864e5);
  return `Next: ${next.title} — ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`;
}

function NextUp() {
  const line = useClientValue(nextUpLine, null);
  return (
    <p className="flex items-center gap-2 text-[13px] text-[#9da7b3]" aria-live="polite">
      <span className="text-[#3fb950]"><DotFillIcon size={16} /></span>{line ?? " "}
    </p>
  );
}

export function SiteFooter({ sticker = true, themes = true }: { sticker?: boolean; themes?: boolean }) {
  return (
    <footer className="relative mt-auto border-t border-[#30363d] bg-[#0d1117] text-[#e6edf3]">
      {sticker && <Sticker name="octocat" size={108} tilt={-6} className="pointer-events-none absolute -top-[74px] right-[8%] hidden md:block" alt="" />}
      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]">
        {/* top: identity + calendar */}
        <div className="flex flex-wrap items-end justify-between gap-8 border-b border-[#30363d] py-14">
          <div className="max-w-[440px]">
            <Link href="/" className="flex items-center gap-3" aria-label="GitHub Community Club BLR — home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/club-mark.png" alt="" width={40} height={40} className="h-10 w-10" />
              <span className="font-display text-[20px] font-bold tracking-tight">GitHub Community Club <span className="text-[#3fb950]">BLR</span></span>
            </Link>
            <p className="mt-4 text-[15px] leading-relaxed text-[#9da7b3]">A student community at {CLUB.university}. We learn Git and GitHub, contribute to open source and run hands-on workshops.</p>
            <div className="mt-5"><NextUp /></div>
            <div className="mt-6"><p className="mb-3 text-[13px] font-semibold text-[#e6edf3]">Follow the club</p><SocialLinks tone="dark" /></div>
          </div>
          <div className="w-full max-w-[380px] rounded-xl border border-[#30363d] bg-[#161b22] p-5">
            <p className="font-display text-[16px] font-semibold">Never miss an event</p>
            <p className="mt-1 text-[14px] text-[#9da7b3]">All {CLUB.events.length} events for {CLUB.year}, in your calendar app.</p>
            <a href="/calendar.ics" download className="press mt-4 inline-flex items-center gap-2 rounded-md border border-[#f0f6fc1a] bg-[#238636] px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-[#2ea043]">
              <CalendarIcon size={16} />Add to calendar
            </a>
          </div>
        </div>

        {/* link columns */}
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4">
          {COLUMNS.filter((c) => c.links.length).map((c) => (
            <div key={c.title}>
              <h2 className="mb-4 font-sans text-[14px] font-semibold tracking-normal [font-stretch:100%] text-[#e6edf3]">{c.title}</h2>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.ext
                      ? <a href={l.href} target="_blank" rel="noopener" className="group inline-flex items-center gap-1 text-[14px] text-[#9da7b3] transition hover:text-[#4493f8]">{l.label}<span className="opacity-0 transition group-hover:opacity-100"><ArrowUpRightIcon size={12} /></span></a>
                      : <Link href={l.href} className="text-[14px] text-[#9da7b3] transition hover:text-[#4493f8]">{l.label}</Link>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* bottom bar: a status line — who we are and where things live, then the small print and the exact deploy */}
      <div className="border-t border-[#f0f6fc14] bg-[#010409] text-[13px] text-[#9da7b3]">
        <div className="mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]">
          <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2.5 text-[#c9d1d9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/club-mark.png" alt="" width={20} height={20} className="h-5 w-5 opacity-90" />
              <span>© {new Date().getFullYear()} GitHub Community Club <span className="text-[#6e7681]">·</span> {CLUB.university}</span>
            </p>
            {themes && <ThemeChoices />}
            <ul className="flex flex-wrap items-center gap-1">
              {[["Privacy", "/privacy"], ["Calendar", "/calendar.ics"], [`${EPOCH.name}_${EPOCH.edition}`, "/epoch"]].map(([l, h]) => (
                <li key={h}><a href={h} {...(h.endsWith(".ics") ? { download: true } : {})} className="rounded-md px-2.5 py-1.5 transition-colors duration-150 hover:bg-[#f0f6fc10] hover:text-white">{l}</a></li>
              ))}
              {ORG && <li><a href={ORG} target="_blank" rel="noopener" aria-label="Club on GitHub" className="grid h-8 w-8 place-items-center rounded-md transition-colors duration-150 hover:bg-[#f0f6fc10] hover:text-white"><MarkGithubIcon size={16} /></a></li>}
              {CLUB.email && <li><a href={`mailto:${CLUB.email}`} aria-label="Email the club" className="grid h-8 w-8 place-items-center rounded-md transition-colors duration-150 hover:bg-[#f0f6fc10] hover:text-white"><MailIcon size={16} /></a></li>}
              <li className="ml-1"><button type="button" onClick={() => scrollToTarget(document.body, 0)} className="inline-flex items-center gap-1.5 rounded-full border border-[#30363d] px-3 py-1.5 transition-colors duration-150 hover:border-[#8b949e] hover:text-white"><ChevronUpIcon size={14} />Back to top</button></li>
            </ul>
          </div>
          <div className="flex flex-col gap-2 border-t border-[#f0f6fc0d] py-4 text-[12px] text-[#7d8590] sm:flex-row sm:items-center sm:justify-between">
            <p>Student-run. Not affiliated with GitHub, Inc. Octocat artwork from the <a href="https://octodex.github.com" target="_blank" rel="noopener" className="underline decoration-[#30363d] underline-offset-2 hover:text-[#c9d1d9]">Octodex</a>.</p>
            {COMMIT && <p className="flex items-center gap-2 font-mono"><span className="h-1.5 w-1.5 rounded-full bg-[#3fb950]" aria-hidden />deployed from main@{COMMIT}</p>}
          </div>
        </div>
      </div>
    </footer>
  );
}
