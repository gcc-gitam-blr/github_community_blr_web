"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRightIcon, CalendarIcon, ChevronUpIcon, DotFillIcon, MailIcon, MarkGithubIcon } from "@primer/octicons-react";
import { CLUB } from "@/lib/config";
import { EPOCH } from "@/lib/epoch/config";
import { Sticker } from "@/components/ui/Sticker";
import { scrollToTarget } from "@/components/ui/SmoothScroll";

/* One footer for the whole site (club pages and Epoch). Links are only shown when they lead somewhere real. */
const ORG = CLUB.githubOrg ? `${CLUB.githubUrl}/${CLUB.githubOrg}` : "";

type L = { label: string; href: string; ext?: boolean };
const COLUMNS: { title: string; links: L[] }[] = [
  { title: "Club", links: [{ label: "About", href: "/#about" }, { label: "What you'll learn", href: "/#learn" }, { label: "Events 2026-27", href: "/#events" }, { label: "FAQ", href: "/#faq" }, { label: "Join the club", href: "/#join" }] },
  { title: "Epoch", links: [{ label: "Overview", href: "/epoch" }, { label: "How coins work", href: "/epoch#ticket" }, { label: "Booths", href: "/epoch/booths" }, { label: "The plan", href: "/epoch#plan" }, { label: "Merch shop", href: "/epoch/shop" }, { label: "Leaderboard", href: "/epoch/leaderboard" }] },
  { title: "Learn on GitHub", links: [{ label: "GitHub Skills", href: "https://skills.github.com", ext: true }, { label: "GitHub Docs", href: "https://docs.github.com", ext: true }, { label: "Student Developer Pack", href: "https://education.github.com/pack", ext: true }, { label: "GitHub Community", href: "https://github.com/community", ext: true }] },
  { title: "Get involved", links: [
    { label: "My Epoch wallet", href: "/epoch/wallet" },
    { label: "Organiser desk", href: "/epoch/admin" },
    ...(ORG ? [{ label: "Contribute to this site", href: ORG, ext: true }] : []),
    ...(CLUB.email ? [{ label: "Email the club", href: `mailto:${CLUB.email}`, ext: true }] : []),
    ...CLUB.socials.filter((s) => s.href && s.href !== "#").map((s) => ({ label: s.label, href: s.href, ext: true })),
  ] },
];

function NextUp() {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const next = [...CLUB.events].sort((a, b) => a.date.localeCompare(b.date)).find((e) => new Date(e.date + "T00:00:00") >= today);
    if (!next) return setLine("That's a wrap for this year — see you next year.");
    const d = Math.round((new Date(next.date + "T00:00:00").getTime() - today.getTime()) / 864e5);
    setLine(`Next: ${next.title} — ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`);
  }, []);
  return (
    <p className="flex items-center gap-2 text-[13px] text-[#9da7b3]" aria-live="polite">
      <span className="text-[#3fb950]"><DotFillIcon size={16} /></span>{line ?? " "}
    </p>
  );
}

export function SiteFooter({ sticker = true }: { sticker?: boolean }) {
  return (
    <footer className="relative mt-auto border-t border-[#30363d] bg-[#0d1117] text-[#e6edf3]">
      {sticker && <Sticker name="octocat" size={108} tilt={-6} className="pointer-events-none absolute -top-[74px] right-[8%] hidden md:block" alt="" />}
      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]">
        {/* top: identity + calendar */}
        <div className="flex flex-wrap items-end justify-between gap-8 border-b border-[#30363d] py-14">
          <div className="max-w-[440px]">
            <Link href="/" className="flex items-center gap-3" aria-label="GitHub Community Club BLR — home">
              <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden>
                <circle cx="20" cy="20" r="20" fill="#fff" />
                <path d="M14 11v18M14 17c0 6 12 2 12 9" fill="none" stroke="#0d1117" strokeWidth="2.6" strokeLinecap="round" />
                <g fill="#fff" stroke="#0d1117" strokeWidth="2.6"><circle cx="14" cy="11" r="3.2" /><circle cx="14" cy="29" r="3.2" /><circle cx="26" cy="27" r="3.2" /></g>
              </svg>
              <span className="font-display text-[20px] font-bold tracking-tight">GitHub Community Club <span className="text-[#3fb950]">BLR</span></span>
            </Link>
            <p className="mt-4 text-[15px] leading-relaxed text-[#9da7b3]">A student community at {CLUB.university}. Workshops, open source, and Epoch — our flagship technical month.</p>
            <div className="mt-5"><NextUp /></div>
          </div>
          <div className="w-full max-w-[380px] rounded-xl border border-[#30363d] bg-[#161b22] p-5">
            <p className="font-display text-[16px] font-semibold">Never miss an event</p>
            <p className="mt-1 text-[14px] text-[#9da7b3]">All {CLUB.events.length} events for {CLUB.year}, in your calendar app.</p>
            <a href="/calendar.ics" download className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#f0f6fc1a] bg-[#238636] px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-[#2ea043]">
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

      {/* bottom bar */}
      <div className="bg-[#010409]">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-6 text-[12.5px] text-[#9da7b3] md:px-[clamp(20px,5vw,72px)]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-2"><MarkGithubIcon size={16} />© {new Date().getFullYear()} GitHub Community Club · {CLUB.university}</span>
            <Link href="/epoch" className="hover:text-[#4493f8]">{EPOCH.name}_{EPOCH.edition}</Link>
            <a href="/calendar.ics" download className="hover:text-[#4493f8]">Calendar (.ics)</a>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>Student-run · not officially affiliated with GitHub, Inc. Octocat artwork from the Octodex.</span>
            {ORG && <a href={ORG} target="_blank" rel="noopener" aria-label="Club on GitHub" className="hover:text-white"><MarkGithubIcon size={18} /></a>}
            {CLUB.email && <a href={`mailto:${CLUB.email}`} aria-label="Email the club" className="hover:text-white"><MailIcon size={18} /></a>}
            <button type="button" onClick={() => scrollToTarget(document.body, 0)} className="inline-flex items-center gap-1 rounded-md border border-[#30363d] px-2.5 py-1 hover:border-[#8b949e] hover:text-white"><ChevronUpIcon size={14} />Top</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
