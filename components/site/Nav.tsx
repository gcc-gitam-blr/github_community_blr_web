"use client";
import { useEffect, useState } from "react";
import { EpochLink } from "@/components/epoch/EpochLink";
import { epochIsLive } from "@/lib/epoch/config";

const LINKS = [["About", "#about"], ["Tracks", "#tracks"], ["Events", "#events"], ["Terminal", "#terminal"], ["Projects", "#projects"], ["FAQ", "#faq"]];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener("scroll", on, { passive: true });
    setLive(epochIsLive());
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/80 shadow-[0_1px_0_var(--color-line)] backdrop-blur-xl" : ""}`}>
      <div className="mx-auto flex max-w-[1240px] items-center gap-10 px-5 py-4 md:px-[clamp(20px,5vw,72px)] md:py-5">
        <a href="#top" className="group flex items-center gap-3" aria-label="GitHub Community Club BLR — home">
          <svg viewBox="0 0 40 40" className="h-10 w-10 transition-transform duration-500 group-hover:-rotate-[20deg] group-hover:scale-110" aria-hidden>
            <circle cx="20" cy="20" r="20" fill="#0b0b0f" />
            <path d="M14 11v18M14 17c0 6 12 2 12 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <g fill="#0b0b0f" stroke="#fff" strokeWidth="2.6"><circle cx="14" cy="11" r="3.2" /><circle cx="14" cy="29" r="3.2" /><circle cx="26" cy="27" r="3.2" /></g>
          </svg>
          <span className="font-display text-[17px] font-semibold tracking-tight">GitHub Community <b className="ml-0.5 rounded bg-brand px-[7px] py-px font-black">BLR</b></span>
        </a>

        <nav aria-label="Primary" className={`${open ? "visible [clip-path:inset(0)]" : "invisible [clip-path:inset(0_0_100%_0)]"} fixed inset-x-0 top-[72px] flex flex-col bg-white px-5 pb-7 pt-3 shadow-2xl transition-[clip-path] duration-500 md:visible md:static md:ml-0 md:mr-auto md:flex-row md:gap-1 md:bg-transparent md:p-0 md:shadow-none md:[clip-path:none]`}>
          {LINKS.map(([l, h]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="relative rounded-lg py-3 font-display text-3xl font-bold md:px-3.5 md:py-2 md:font-sans md:text-[15px] md:font-medium after:absolute after:inset-x-3.5 after:bottom-1 after:hidden after:h-0.5 after:origin-left after:scale-x-0 after:bg-ink after:transition-transform md:after:block hover:after:scale-x-100">{l}</a>
          ))}
          <EpochLink className="mt-2 inline-flex items-center gap-2 py-3 font-display text-3xl font-bold md:mt-0 md:px-3.5 md:py-2 md:font-sans md:text-[15px] md:font-semibold">
            <span className="rounded bg-ink px-2 py-0.5 font-mono text-[13px] font-bold text-gold">EPOCH</span>
            {live && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-brand" title="Live now" />}
          </EpochLink>
        </nav>

        <div className="ml-auto hidden items-center gap-5 md:ml-0 md:flex">
          <a href="https://github.com" target="_blank" rel="noopener" className="text-[15px] font-medium hover:underline hover:underline-offset-4">GitHub</a>
          <a href="#join" className="lift rounded-md border-2 border-ink bg-ink px-5 py-3 font-display text-[15px] font-bold text-white">Join the club</a>
        </div>

        <button className="relative ml-auto h-11 w-11 md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className={`absolute inset-x-2.5 h-0.5 rounded bg-ink transition-all ${open ? "top-[21px] rotate-45" : "top-4"}`} />
          <span className={`absolute inset-x-2.5 h-0.5 rounded bg-ink transition-all ${open ? "top-[21px] -rotate-45" : "top-[26px]"}`} />
        </button>
      </div>
    </header>
  );
}
