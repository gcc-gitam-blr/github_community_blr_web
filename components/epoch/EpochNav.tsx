"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useEpoch } from "./EpochProvider";
import { Coin } from "./Bits";
import { EPOCH } from "@/lib/epoch/config";

const LINKS = [["Stalls", "/epoch/stalls"], ["Shop", "/epoch/shop"], ["Leaderboard", "/epoch/leaderboard"], ["Scan", "/epoch/scan"], ["Wallet", "/epoch/wallet"]];

export function EpochNav() {
  const path = usePathname(); const { me } = useEpoch(); const [open, setOpen] = useState(false);
  const staff = me && me.role !== "attendee";
  const cell = "flex items-center border-r border-epoch-line/70 px-5 font-mono text-[13px] uppercase tracking-[0.16em] transition hover:bg-epoch/40";
  return (
    <header className="sticky top-0 z-40 border-b border-epoch-line/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[70px] max-w-[1600px] items-stretch">
        <Link href="/epoch" className="flex items-center gap-2.5 border-r border-epoch-line/70 px-5" aria-label="Epoch home"><Coin size={30} /><span className="hidden font-display text-lg font-black tracking-tight sm:inline">{EPOCH.name}&apos;{EPOCH.edition}</span></Link>
        <nav className="hidden flex-1 md:flex">
          {LINKS.map(([l, h]) => <Link key={h} href={h} className={`${cell} ${path === h ? "bg-epoch/60" : ""}`}>{l}</Link>)}
          {staff && <Link href="/epoch/admin" className={`${cell} ${path === "/epoch/admin" ? "bg-epoch/60" : ""}`}>Admin</Link>}
        </nav>
        <div className="ml-auto flex items-stretch">
          {me
            ? <Link href="/epoch/wallet" className={`${cell} border-l gap-2 font-bold`}><Coin size={20} />{me.coins}</Link>
            : <Link href="/epoch/register" className={`${cell} border-l bg-epoch font-bold`}>Sign up</Link>}
          <Link href="/" className={`${cell} hidden border-r-0 sm:flex`}>← Club</Link>
          <button className={`${cell} border-l md:hidden`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">{open ? "✕" : "☰"}</button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-epoch-line/70 bg-white md:hidden">
          {[...LINKS, ["← Club site", "/"], ...(staff ? [["Admin", "/epoch/admin"]] : [])].map(([l, h]) => (
            <Link key={h} href={h} onClick={() => setOpen(false)} className="block border-b border-epoch-line/40 px-5 py-4 font-mono text-sm uppercase tracking-[0.16em]">{l}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
