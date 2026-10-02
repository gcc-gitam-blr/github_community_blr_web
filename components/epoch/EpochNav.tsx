"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useEpoch } from "./EpochProvider";
import { Coin, Wordmark } from "./Bits";
import { Launcher, useCommand } from "./Command";
import { BOOTH_COUNT } from "@/lib/epoch/config";

const ITEMS = [
  { l: "Wallet", h: "/epoch/wallet", i: "M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2" },
  { l: "Booths", h: "/epoch/booths", i: "M4 7h16M4 12h16M4 17h10", badge: String(BOOTH_COUNT) },
  { l: "Shop", h: "/epoch/shop", i: "M5 8h14l-1 12H6L5 8zm4 0a3 3 0 016 0" },
  { l: "Board", h: "/epoch/leaderboard", i: "M6 20V10m6 10V4m6 16v-7" },
  { l: "Scan", h: "/epoch/scan", i: "M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16" },
  { l: "Plan", h: "/epoch#plan", i: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" },
];
const Icon = ({ d, s = 20 }: { d: string; s?: number }) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-none"><path d={d} /></svg>;
const glassBar = "border border-white/80 bg-white/65 shadow-[0_10px_40px_-18px_rgba(70,45,130,.4)] backdrop-blur-xl";

export function EpochNav() {
  const path = usePathname(); const { me } = useEpoch(); const { open } = useCommand();
  const landing = path === "/epoch";
  const staff = !!me && me.role !== "attendee";
  const [scrolled, setScrolled] = useState(false);
  // the rail is fixed; fade it out once the footer scrolls into view so they never overlap
  const [footerIn, setFooterIn] = useState(false);
  useEffect(() => {
    const f = document.querySelector("footer"); if (!f) return;
    const io = new IntersectionObserver(([e]) => setFooterIn(e.isIntersecting), { rootMargin: "0px 0px -35% 0px" });
    io.observe(f); return () => io.disconnect();
  }, [path]);
  useEffect(() => { const on = () => setScrolled(window.scrollY > 520); on(); window.addEventListener("scroll", on, { passive: true }); return () => window.removeEventListener("scroll", on); }, []);
  const showBar = !landing || scrolled; // on the landing page the hero has its own big pill

  const items = [...ITEMS, ...(staff ? [{ l: "Desk", h: "/epoch/admin", i: "M4 6h16v12H4zM8 10h8M8 14h5" }] : [])];

  return (
    <>
      {/* top bar: brand · glass command pill · balance */}
      <header className="no-print fixed inset-x-0 top-0 z-40 flex items-center gap-3 px-4 py-4 md:px-7">
        <Link href="/epoch" className={`flex h-[52px] items-center gap-2.5 rounded-full pl-2.5 pr-5 ${glassBar}`} aria-label="Epoch home"><Coin size={34} /><Wordmark className="text-[22px]" /></Link>
        <div className={`mx-auto hidden w-full max-w-[520px] transition-[translate,opacity] duration-300 ease-out md:block ${showBar ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"}`}><Launcher /></div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <button onClick={open} aria-label="Search" className={`grid h-[52px] w-[52px] place-items-center rounded-full md:hidden ${glassBar}`}><Icon d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5" /></button>
          {me
            ? <Link href="/epoch/wallet" className="flex h-[52px] items-center gap-2 rounded-full bg-ink pl-3 pr-5 text-[15px] font-medium text-white"><Coin size={28} />{me.coins}</Link>
            : <Link href="/epoch/register" className="press flex h-[52px] items-center rounded-full bg-ink px-6 text-[15px] font-medium text-white">Get ticket</Link>}
          <Link href="/" className="hidden px-3 text-sm text-mute hover:text-ink lg:block">Club site</Link>
        </div>
      </header>

      {/* dashboard rail (app screens, desktop) */}
      {!landing && (
        <nav aria-label="Epoch" className={`no-print fixed left-6 top-[104px] z-30 hidden w-[184px] transition-opacity duration-300 lg:block ${footerIn ? "pointer-events-none opacity-0" : ""}`}>
          <ul className="space-y-1">
            {items.map((n) => {
              const on = path === n.h;
              return (
                <li key={n.h}>
                  <Link href={n.h} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[16px] transition ${on ? `${glassBar} text-ink` : "text-mute hover:bg-white/50 hover:text-ink"}`}>
                    <Icon d={n.i} />{n.l}{"badge" in n && <span className="ml-auto rounded-full bg-ink/[.07] px-2 py-0.5 text-[12px]">{n.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 px-4 text-[12px] text-mute">Press <kbd className="rounded-md border border-hair bg-white/70 px-1.5 font-mono">/</kbd> to search</p>
        </nav>
      )}

      {/* phone tab bar */}
      <nav aria-label="Epoch tabs" className={`no-print fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-5 items-center rounded-[28px] px-2 py-2 md:hidden ${glassBar}`}>
        {[ITEMS[1], ITEMS[2]].map((n) => <Link key={n.h} href={n.h} className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${path === n.h ? "text-ink" : "text-mute"}`}><Icon d={n.i} s={22} />{n.l}</Link>)}
        <Link href="/epoch/scan" className="-mt-6 mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink text-white shadow-[0_12px_30px_-8px_rgba(18,18,26,.6)]" aria-label="Scan"><Icon d={ITEMS[4].i} s={24} /></Link>
        <Link href="/epoch/leaderboard" className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${path === "/epoch/leaderboard" ? "text-ink" : "text-mute"}`}><Icon d={ITEMS[3].i} s={22} />Board</Link>
        <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${path === "/epoch/wallet" || path === "/epoch/register" ? "text-ink" : "text-mute"}`}><Icon d={ITEMS[0].i} s={22} />{me ? "Wallet" : "Ticket"}</Link>
      </nav>
    </>
  );
}
