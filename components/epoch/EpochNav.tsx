"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEpoch } from "./EpochProvider";
import { Coin, Wordmark } from "./Bits";

const LINKS = [
  { l: "Booths", h: "/epoch/booths", i: "M4 7h16M4 12h16M4 17h10" },
  { l: "Plan", h: "/epoch#plan", i: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" },
  { l: "Shop", h: "/epoch/shop", i: "M5 8h14l-1 12H6L5 8zm4 0a3 3 0 016 0" },
  { l: "Board", h: "/epoch/leaderboard", i: "M6 20V10m6 10V4m6 16v-7" },
];
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const glassBar = "border border-white/70 bg-white/60 shadow-[0_10px_40px_-18px_rgba(70,45,130,.4)] backdrop-blur-xl";

export function EpochNav() {
  const path = usePathname(); const { me } = useEpoch();
  const staff = !!me && me.role !== "attendee";
  const on = (h: string) => path === h;

  return (
    <>
      {/* desktop: a quiet floating pill */}
      <header className="no-print fixed inset-x-0 top-5 z-40 hidden justify-center md:flex">
        <nav aria-label="Epoch" className={`flex items-center gap-1 rounded-full p-1.5 pl-6 ${glassBar}`}>
          <Link href="/epoch" className="mr-4 text-[22px]" aria-label="Epoch home"><Wordmark /></Link>
          {LINKS.map((n) => <Link key={n.h} href={n.h} className={`rounded-full px-4 py-2.5 text-sm transition ${on(n.h) ? "bg-ink/[.06] text-ink" : "text-mute hover:text-ink"}`}>{n.l}</Link>)}
          {staff && <Link href="/epoch/admin" className={`rounded-full px-4 py-2.5 text-sm transition ${on("/epoch/admin") ? "bg-ink/[.06]" : "text-mute hover:text-ink"}`}>Desk</Link>}
          <Link href="/epoch/scan" className={`rounded-full px-4 py-2.5 text-sm transition ${on("/epoch/scan") ? "bg-ink/[.06] text-ink" : "text-mute hover:text-ink"}`}>Scan</Link>
          {me
            ? <Link href="/epoch/wallet" className="ml-1 flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"><Coin size={16} />{me.coins}</Link>
            : <Link href="/epoch/register" className="ml-1 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">Get ticket</Link>}
        </nav>
      </header>

      {/* phone: slim top bar + bottom tab bar (used one-handed at the fest) */}
      <header className="no-print fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-4 md:hidden">
        <Link href="/epoch" className="text-2xl" aria-label="Epoch home"><Wordmark /></Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-mute">Club</Link>
          {me && <Link href="/epoch/wallet" className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${glassBar}`}><Coin size={15} />{me.coins}</Link>}
        </div>
      </header>
      <nav aria-label="Epoch tabs" className={`no-print fixed inset-x-4 bottom-4 z-40 grid grid-cols-5 items-center rounded-[28px] px-2 py-2 md:hidden ${glassBar}`}>
        {[LINKS[0], LINKS[2]].map((n) => <Link key={n.h} href={n.h} className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${on(n.h) ? "text-ink" : "text-mute"}`}><Icon d={n.i} />{n.l}</Link>)}
        <Link href="/epoch/scan" className="-mt-6 mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink text-white shadow-[0_12px_30px_-8px_rgba(18,18,26,.6)]" aria-label="Scan">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16" /></svg>
        </Link>
        <Link href="/epoch/leaderboard" className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${on("/epoch/leaderboard") ? "text-ink" : "text-mute"}`}><Icon d={LINKS[3].i} />Board</Link>
        <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${on("/epoch/wallet") || on("/epoch/register") ? "text-ink" : "text-mute"}`}><Icon d="M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2" />{me ? "Wallet" : "Ticket"}</Link>
      </nav>
    </>
  );
}
