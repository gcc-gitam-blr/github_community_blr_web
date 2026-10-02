"use client";
import Link from "next/link";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useClientValue, todayISO } from "@/lib/useClientValue";
import { EpochLink } from "@/components/epoch/EpochLink";
import { EpochCoin } from "@/components/epoch/EpochCoin";
import { daysToEpoch, epochIsLive } from "@/lib/epoch/config";
import { eventSlug, nextEvent } from "@/lib/events";
import { Announcement } from "./Announcement";
import { MobileMenu } from "./MobileMenu";
import { SiteSearch } from "./SiteSearch";
import { useActiveSection } from "./useActiveSection";
import { NAV_LINKS } from "./nav-links";

/* The "branch bar": the club's header reads like a repository path — `GitHub Community BLR / events` —
   and the part after the slash follows you as you scroll the home page or move between pages.
   A green marker slides under the link for where you are. */

// the path segment shown after the club name, for each home-page section
const SECTION_SEGMENT: Record<string, string> = { top: "main", github: "new-here", shipped: "changelog", about: "about", learn: "learn", events: "events", gallery: "gallery", projects: "projects", team: "team", faq: "faq", join: "join" };
// which nav link is "current" for each section (sections not listed light up nothing)
const SECTION_LINK: Record<string, string> = { learn: "/learn", events: "/#events", about: "/#about", team: "/#about", faq: "/#about" };

const onScroll = (cb: () => void) => { window.addEventListener("scroll", cb, { passive: true }); return () => window.removeEventListener("scroll", cb); };

export function Nav() {
  const path = usePathname();
  const home = path === "/";
  const section = useActiveSection(home);
  const scrolled = useSyncExternalStore(onScroll, () => window.scrollY > 8, () => false);
  const live = useClientValue(() => epochIsLive(), false);
  const soon = useClientValue(() => daysToEpoch(), null);
  const next = useClientValue(() => { const n = nextEvent(todayISO()); return n ? `${eventSlug(n.event)}|${n.days}|${n.event.date}|${n.event.title}` : null; }, null);

  const page = path.split("/")[1] ?? "";
  const segment = home ? SECTION_SEGMENT[section] ?? "main" : page;
  const current = home ? SECTION_LINK[section] ?? "" : page === "events" ? "/#events" : `/${page}`;
  // on other pages, links to home sections need the full path; on home they're just #anchors
  const href = (h: string) => (home && h.startsWith("/#") ? h.slice(1) : h);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {(live || soon) ? (
        <EpochLink href={live ? "/epoch/wallet" : "/epoch/register"} className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center font-mono text-[12.5px] text-white">
          <span className={`h-2 w-2 flex-none rounded-full ${live ? "animate-pulse-ring bg-brand" : "bg-gold"}`} />
          {live ? <>Epoch is live — <u className="text-gold underline-offset-4">open your wallet</u> →</> : <>Epoch starts in <b className="text-gold">{soon} day{soon === 1 ? "" : "s"}</b> — get your ticket →</>}
        </EpochLink>
      ) : <Announcement />}

      <div className={`branch-bar ${scrolled ? "is-scrolled" : ""}`}>
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-5 lg:px-[clamp(20px,5vw,72px)]">
          <a href={home ? "#top" : "/"} className="group flex flex-none items-center gap-2.5" aria-label="GitHub Community BLR — home">
            <svg viewBox="0 0 40 40" className="h-9 w-9 flex-none transition-transform duration-300 ease-out group-hover:-rotate-[20deg]" aria-hidden>
              <circle cx="20" cy="20" r="20" fill="#0b0b0f" />
              <path d="M14 11v18M14 17c0 6 12 2 12 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
              <g fill="#0b0b0f" stroke="#fff" strokeWidth="2.6"><circle cx="14" cy="11" r="3.2" /><circle cx="14" cy="29" r="3.2" /><circle cx="26" cy="27" r="3.2" /></g>
            </svg>
            <span className="whitespace-nowrap font-display text-[16px] font-semibold tracking-tight"><span className="hidden sm:inline">GitHub Community </span><b className="rounded bg-brand px-[6px] py-px font-black">BLR</b></span>
          </a>
          {/* the "current branch": where you are, like a path in a repository */}
          {segment && (
            <span aria-hidden className="-ml-1 flex flex-none items-center gap-1.5 font-mono text-[13px] text-ink-3">
              <span>/</span><span key={segment} className="branch-seg truncate text-ink-2">{segment}</span>
            </span>
          )}

          <DesktopLinks current={current} href={href} live={live} />
          <SiteSearch />

          {next && <NextChip next={next} />}
          <a href={href("/#join")} className="press lift hidden whitespace-nowrap rounded-md border-2 border-ink bg-ink px-4 py-2 font-display text-[14.5px] font-bold text-white lg:inline-block">Join the club</a>
          <MobileMenu href={href} current={current} live={live} />
        </div>
      </div>
    </header>
  );
}

/** The links, with a green marker that slides to the current one. */
function DesktopLinks({ current, href, live }: { current: string; href: (h: string) => string; live: boolean }) {
  const list = useRef<HTMLUListElement>(null);
  const [mark, setMark] = useState<{ x: number; w: number; first: boolean } | null>(null);
  useLayoutEffect(() => {
    const ul = list.current; if (!ul) return;
    const place = () => {
      const a = ul.querySelector<HTMLElement>(`[data-href="${current}"]`);
      setMark((m) => (a ? { x: a.offsetLeft + 10, w: a.offsetWidth - 20, first: !m } : null));
    };
    place();
    const ro = new ResizeObserver(place); ro.observe(ul); // fonts and widths settle after load
    return () => ro.disconnect();
  }, [current]);

  return (
    <nav aria-label="Primary" className="ml-auto hidden lg:block">
      <ul ref={list} className="relative flex items-center gap-0.5">
        {NAV_LINKS.map((l) => (
          <li key={l.href}>
            <a href={href(l.href)} data-href={l.href} aria-current={current === l.href ? "page" : undefined}
              className={`block whitespace-nowrap rounded-md px-2.5 py-2 text-[15px] transition-colors duration-150 hover:bg-black/[.04] xl:px-3 ${current === l.href ? "font-semibold text-ink" : "font-medium text-ink-2 hover:text-ink"}`}>{l.label}</a>
          </li>
        ))}
        <li>
          <EpochLink className="ml-1 inline-flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-black/[.04]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pl-1 pr-2.5 font-mono text-[12px] font-bold text-gold"><EpochCoin size={20} detail={false} />EPOCH</span>
            {live && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-brand" title="Live now" />}
          </EpochLink>
        </li>
        {mark && <span aria-hidden className={`branch-mark ${mark.first ? "no-anim" : ""}`} style={{ transform: `translateX(${mark.x}px) scaleX(${mark.w / 100})` }} />}
      </ul>
    </nav>
  );
}

/** "Next · Wed 7 Oct" — the next club event, two clicks from anywhere. */
function NextChip({ next }: { next: string }) {
  const [slug, days, date, title] = next.split("|");
  const d = Number(days);
  const when = d === 0 ? "today" : d === 1 ? "tomorrow" : new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return (
    <Link href={`/events/${slug}`} aria-label={`Next event: ${title}, ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`}
      className="press hidden items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white/70 px-3 py-1.5 text-[13px] text-ink-2 transition-colors duration-150 hover:border-ink/30 hover:text-ink min-[1480px]:inline-flex">
      <span className="h-2 w-2 rounded-full bg-[#2da44e] shadow-[0_0_0_3px_rgba(45,164,78,.18)]" aria-hidden />
      Next · <b className="font-semibold text-ink">{when}</b>
    </Link>
  );
}
