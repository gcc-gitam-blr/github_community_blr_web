"use client";
import { useState, useSyncExternalStore } from "react";
import { useClientValue } from "@/lib/useClientValue";
import { EpochLink } from "@/components/epoch/EpochLink";
import { usePathname } from "next/navigation";
import { daysToEpoch, epochIsLive } from "@/lib/epoch/config";
import { CLUB } from "@/lib/config";
import { EpochCoin } from "@/components/epoch/EpochCoin";

const LINKS = [["About", "#about"], ["Learn", "#learn"], ["Events", "#events"], ["Projects", "#projects"], ["FAQ", "#faq"]].filter(([, h]) => h !== "#projects" || CLUB.githubOrg);
const ORG_URL = CLUB.githubOrg ? `${CLUB.githubUrl}/${CLUB.githubOrg}` : "";

const onScroll = (cb: () => void) => { window.addEventListener("scroll", cb, { passive: true }); return () => window.removeEventListener("scroll", cb); };

export function Nav() {
  const scrolled = useSyncExternalStore(onScroll, () => window.scrollY > 12, () => false);
  const [open, setOpen] = useState(false);
  const live = useClientValue(() => epochIsLive(), false);
  const soon = useClientValue(() => daysToEpoch(), null);
  // on pages other than home, section links need to go back to the home page first
  const home = usePathname() === "/"; const to = (h: string) => (home ? h : "/" + h);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 shadow-[0_1px_0_var(--color-line)] backdrop-blur-xl" : ""}`}>
      {(live || soon) && (
        <EpochLink href={live ? "/epoch/wallet" : "/epoch/register"} className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center font-mono text-[12.5px] text-white">
          <span className={`h-2 w-2 flex-none rounded-full ${live ? "animate-pulse-ring bg-brand" : "bg-gold"}`} />
          {live ? <>Epoch is live — <u className="text-gold underline-offset-4">open your wallet</u> →</> : <>Epoch starts in <b className="text-gold">{soon} day{soon === 1 ? "" : "s"}</b> — get your ticket →</>}
        </EpochLink>
      )}
      <div className="mx-auto flex max-w-[1240px] items-center gap-10 px-5 py-4 md:px-[clamp(20px,5vw,72px)] md:py-5">
        <a href={home ? "#top" : "/"} className="group flex items-center gap-3" aria-label="GitHub Community Club BLR — home">
          <svg viewBox="0 0 40 40" className="h-10 w-10 transition-transform duration-500 group-hover:-rotate-[20deg] group-hover:scale-110" aria-hidden>
            <circle cx="20" cy="20" r="20" fill="#0b0b0f" />
            <path d="M14 11v18M14 17c0 6 12 2 12 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <g fill="#0b0b0f" stroke="#fff" strokeWidth="2.6"><circle cx="14" cy="11" r="3.2" /><circle cx="14" cy="29" r="3.2" /><circle cx="26" cy="27" r="3.2" /></g>
          </svg>
          <span className="font-display text-[17px] font-semibold tracking-tight">GitHub Community <b className="ml-0.5 rounded bg-brand px-[7px] py-px font-black">BLR</b></span>
        </a>

        <nav aria-label="Primary" className={`${open ? "visible [clip-path:inset(0)]" : "invisible [clip-path:inset(0_0_100%_0)]"} ${live || soon ? "top-[108px]" : "top-[72px]"} fixed inset-x-0 flex flex-col bg-white px-5 pb-7 pt-3 shadow-2xl transition-[clip-path] duration-500 md:visible md:static md:ml-0 md:mr-auto md:flex-row md:gap-1 md:bg-transparent md:p-0 md:shadow-none md:[clip-path:none]`}>
          {LINKS.map(([l, h]) => (
            <a key={h} href={to(h)} onClick={() => setOpen(false)} className="relative rounded-lg py-3 font-display text-3xl font-bold md:px-3.5 md:py-2 md:font-sans md:text-[15px] md:font-medium after:absolute after:inset-x-3.5 after:bottom-1 after:hidden after:h-0.5 after:origin-left after:scale-x-0 after:bg-ink after:transition-transform md:after:block hover:after:scale-x-100">{l}</a>
          ))}
          <EpochLink className="mt-2 inline-flex items-center gap-2 py-3 font-display text-3xl font-bold md:mt-0 md:px-3.5 md:py-2 md:font-sans md:text-[15px] md:font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pl-1 pr-2.5 font-mono text-[12px] font-bold text-gold"><EpochCoin size={20} detail={false} />EPOCH</span>
            {live && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-brand" title="Live now" />}
          </EpochLink>
        </nav>

        <div className="ml-auto hidden items-center gap-5 md:ml-0 md:flex">
          {ORG_URL && <a href={ORG_URL} target="_blank" rel="noopener" className="text-[15px] font-medium hover:underline hover:underline-offset-4">GitHub</a>}
          <a href={to("#join")} className="lift rounded-md border-2 border-ink bg-ink px-5 py-3 font-display text-[15px] font-bold text-white">Join the club</a>
        </div>

        <button className="relative ml-auto h-11 w-11 md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className={`absolute inset-x-2.5 h-0.5 rounded bg-ink transition-all ${open ? "top-[21px] rotate-45" : "top-4"}`} />
          <span className={`absolute inset-x-2.5 h-0.5 rounded bg-ink transition-all ${open ? "top-[21px] -rotate-45" : "top-[26px]"}`} />
        </button>
      </div>
    </header>
  );
}
