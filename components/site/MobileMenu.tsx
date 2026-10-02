"use client";
import { useState } from "react";
import { EpochLink } from "@/components/epoch/EpochLink";
import { EpochCoin } from "@/components/epoch/EpochCoin";
import { SocialLinks } from "./SocialLinks";
import { NAV_LINKS } from "./nav-links";

/* The phone menu: a panel under the header. */
export function MobileMenu({ href, current, live }: { href: (h: string) => string; current: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="relative ml-auto h-11 w-11 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`absolute inset-x-2.5 h-0.5 rounded bg-ink transition-[top,rotate] duration-200 ease-out ${open ? "top-[21px] rotate-45" : "top-4"}`} />
        <span className={`absolute inset-x-2.5 h-0.5 rounded bg-ink transition-[top,rotate] duration-200 ease-out ${open ? "top-[21px] -rotate-45" : "top-[26px]"}`} />
      </button>
      <nav aria-label="Primary" className={`${open ? "visible [clip-path:inset(0)]" : "invisible [clip-path:inset(0_0_100%_0)]"} absolute inset-x-0 top-full flex flex-col bg-white px-5 pb-7 pt-3 shadow-2xl transition-[clip-path] duration-300 ease-out lg:hidden`}>
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={href(l.href)} onClick={() => setOpen(false)} aria-current={current === l.href ? "page" : undefined} className="py-3 font-display text-3xl font-bold">{l.label}</a>
        ))}
        <EpochLink className="mt-2 inline-flex items-center gap-2 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pl-1 pr-2.5 font-mono text-[12px] font-bold text-gold"><EpochCoin size={20} detail={false} />EPOCH</span>
          {live && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-brand" title="Live now" />}
        </EpochLink>
        <div className="mt-6"><SocialLinks /></div>
      </nav>
    </>
  );
}
