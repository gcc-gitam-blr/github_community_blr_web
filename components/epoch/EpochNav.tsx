"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEpoch } from "./EpochProvider";
import { Coin, Wordmark } from "./Bits";

const LINKS = [
  { l: "Booths", h: "/epoch/booths", i: "M4 6h16M4 12h16M4 18h10" },
  { l: "Plan", h: "/epoch#plan", i: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" },
  { l: "Shop", h: "/epoch/shop", i: "M5 8h14l-1 12H6L5 8zm4 0a3 3 0 016 0" },
  { l: "Board", h: "/epoch/leaderboard", i: "M6 20V10m6 10V4m6 16v-7" },
];
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;

export function EpochNav() {
  const path = usePathname(); const { me } = useEpoch();
  const staff = !!me && me.role !== "attendee";
  const on = (h: string) => path === h.split("#")[0] && !h.includes("#");

  return (
    <>
      {/* desktop: floating pill */}
      <header className="no-print fixed inset-x-0 top-4 z-40 hidden justify-center px-4 md:flex">
        <nav aria-label="Epoch" className="flex items-center gap-1 rounded-full border border-white/10 bg-night/70 p-1.5 pl-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl">
          <Link href="/epoch" className="mr-3 flex items-center gap-2" aria-label="Epoch home"><Coin size={22} /><Wordmark className="text-2xl" /></Link>
          {LINKS.map((n) => <Link key={n.h} href={n.h} className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${on(n.h) ? "bg-white/10 text-white" : "text-fog hover:text-white"}`}>{n.l}</Link>)}
          {staff && <Link href="/epoch/admin" className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${path === "/epoch/admin" ? "bg-white/10 text-white" : "text-gold hover:text-gold-soft"}`}>Desk</Link>}
          <Link href="/epoch/scan" className="ml-1 rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20">Scan</Link>
          {me
            ? <Link href="/epoch/wallet" className="ml-1 flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-bold text-night"><Coin size={18} />{me.coins}</Link>
            : <Link href="/epoch/register" className="ml-1 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-night">Get ticket</Link>}
          <Link href="/" className="ml-1 rounded-full px-4 py-2.5 text-sm text-fog transition hover:text-white" title="Back to the club site">← Club</Link>
        </nav>
      </header>

      {/* mobile: top bar + bottom tab bar (this is used one-handed at the fest) */}
      <header className="no-print fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-night/80 px-5 py-3 backdrop-blur-xl md:hidden">
        <Link href="/epoch" className="flex items-center gap-2"><Coin size={22} /><Wordmark className="text-2xl" /></Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-fog">← Club</Link>
          {me && <Link href="/epoch/wallet" className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-sm font-bold text-night"><Coin size={16} />{me.coins}</Link>}
        </div>
      </header>
      <nav aria-label="Epoch tabs" className="no-print fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 items-center rounded-3xl border border-white/10 bg-night/85 px-2 py-2 shadow-[0_20px_60px_-10px_rgba(0,0,0,.9)] backdrop-blur-xl md:hidden">
        {[LINKS[0], LINKS[2]].map((n) => <Link key={n.h} href={n.h} className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${on(n.h) ? "text-gold" : "text-fog"}`}><Icon d={n.i} />{n.l}</Link>)}
        <Link href="/epoch/scan" className="-mt-7 mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold text-night shadow-[0_10px_30px_-4px_rgba(255,201,51,.7)]" aria-label="Scan">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16" /></svg>
        </Link>
        <Link href="/epoch/leaderboard" className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${on("/epoch/leaderboard") ? "text-gold" : "text-fog"}`}><Icon d={LINKS[3].i} />Board</Link>
        <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${path === "/epoch/wallet" || path === "/epoch/register" ? "text-gold" : "text-fog"}`}><Icon d="M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2" />{me ? "Wallet" : "Ticket"}</Link>
      </nav>
    </>
  );
}
