"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useClientValue } from "@/lib/useClientValue";
import { EpochLink } from "@/components/epoch/EpochLink";
import { EpochCoin } from "@/components/epoch/EpochCoin";
import { daysToEpoch, epochIsLive } from "@/lib/epoch/config";
import { Announcement } from "./Announcement";
import { MobileMenu } from "./MobileMenu";
import { EpochNudge } from "./EpochNudge";
import { SiteSearch } from "./SiteSearch";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useActiveSection } from "./useActiveSection";
import { NAV_LINKS } from "./nav-links";
import { ClubMark } from "@/components/ui/ClubMark";

/* The header is a commit graph. Each place on the site is a commit on one branch; where you are is HEAD.
   Commits behind HEAD are filled and joined by a solid line (history); the ones ahead are hollow on a
   dashed line (not checked out yet). On the home page HEAD walks along the branch as you scroll.
   The capsule shrinks to just the commits while you read and opens again when you scroll up, hover or tab in. */
const COMMITS = [...NAV_LINKS.map((l) => ({ label: l.label, href: l.href })), { label: "Epoch", href: "/epoch" }];

// which commit is HEAD for each home-page section
const SECTION_HEAD: Record<string, string> = { learn: "/learn", events: "/#events", about: "/#about", team: "/#about", faq: "/#about" };

/** true while reading down the page; false near the top or as soon as you scroll back up */
function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let last = window.scrollY, raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0; const y = window.scrollY, d = y - last;
        if (y < 140) setCompact(false); else if (d > 6) setCompact(true); else if (d < -6) setCompact(false);
        last = y;
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  return compact;
}

export function Nav() {
  const path = usePathname();
  const home = path === "/";
  const section = useActiveSection(home);
  const compact = useCompact();
  const live = useClientValue(() => epochIsLive(), false);
  const soon = useClientValue(() => daysToEpoch(), null);

  const page = path.split("/")[1] ?? "";
  const current = home ? SECTION_HEAD[section] ?? "" : page === "events" ? "/#events" : `/${page}`;
  const head = COMMITS.findIndex((c) => c.href === current);
  // on other pages, links to home sections need the full path; on home they're just #anchors
  const href = (h: string) => (home && h.startsWith("/#") ? h.slice(1) : h);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="pointer-events-auto">
        {(live || soon) ? (
          <EpochLink href={live ? "/epoch/wallet" : "/epoch/register"} className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center font-mono text-[12.5px] text-white">
            <span className={`h-2 w-2 flex-none rounded-full ${live ? "animate-pulse-ring bg-brand" : "bg-gold"}`} />
            {live ? <>Epoch is live — <u className="text-gold underline-offset-4">open your wallet</u> →</> : <>Epoch starts in <b className="text-gold">{soon} day{soon === 1 ? "" : "s"}</b> — get your ticket →</>}
          </EpochLink>
        ) : <Announcement />}
      </div>

      <div className="flex justify-center px-3 pt-3">
        <div className="head-pill pointer-events-auto" data-compact={compact}>
          <a href={home ? "#top" : "/"} className="group flex flex-none items-center gap-2 rounded-full py-1 pl-0.5 pr-1.5" aria-label="GitHub Community BLR — home">
            <ClubMark size={32} className="transition-transform duration-300 ease-out group-hover:-rotate-[14deg]" />
            <span className="head-word hidden whitespace-nowrap font-display text-[15px] font-semibold tracking-tight xl:inline">GitHub Community</span>
            <b className="rounded bg-brand px-[6px] py-px font-display text-[15px] font-black">BLR</b>
          </a>

          <span aria-hidden className="head-sep hidden h-6 w-px bg-black/10 lg:block" />
          <CommitNav head={head} href={href} live={live} />
          <MiniGraph head={head} label={head >= 0 ? COMMITS[head].label : home ? "main" : page} />

          <SiteSearch />
          <ThemeToggle className="hidden lg:inline-flex" />
          <a href={href("/#join")} className="press hidden h-9 flex-none items-center whitespace-nowrap rounded-full bg-ink px-4 font-display text-[14px] font-bold text-white transition-colors duration-150 hover:bg-ink/85 lg:inline-flex">
            <span className="head-join-long">Join the club</span><span className="head-join-short">Join</span>
          </a>
          <MobileMenu href={href} current={current} live={live} />
        </div>
      </div>
      <EpochNudge hidden={compact} />
    </header>
  );
}

/** Desktop: the branch, with a commit per place. */
function CommitNav({ head, href, live }: { head: number; href: (h: string) => string; live: boolean }) {
  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ol className="commits">
        {COMMITS.map((c, i) => {
          const state = head < 0 ? "is-idle" : i < head ? "is-past" : i === head ? "is-head" : "is-ahead";
          const inner = (<>
            <span className={`commit-node ${c.href === "/epoch" ? "is-coin" : ""}`} aria-hidden>{c.href === "/epoch" && <EpochCoin size={16} detail={false} />}</span>
            <span className="commit-label">{c.label}{c.href === "/epoch" && live ? " · live" : ""}</span>
          </>);
          return (
            <li key={c.href} className={`commit ${state}`}>
              {c.href === "/epoch"
                ? <EpochLink className="commit-link">{inner}</EpochLink>
                : <a href={href(c.href)} className="commit-link" aria-current={i === head ? "page" : undefined}>{inner}</a>}
              {i < COMMITS.length - 1 && <span className="commit-edge" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Phones: the same branch as dots, plus where you are. Decorative — the menu has the links. */
function MiniGraph({ head, label }: { head: number; label: string }) {
  return (
    <span aria-hidden className="mini-graph lg:hidden">
      <span className="mini-dots">
        {COMMITS.map((c, i) => (
          <span key={c.href} className={`mini-dot ${head < 0 ? "" : i < head ? "is-past" : i === head ? "is-head" : "is-ahead"} ${c.href === "/epoch" ? "is-coin" : ""}`} />
        ))}
      </span>
      <span key={label} className="mini-label">{label}</span>
    </span>
  );
}
