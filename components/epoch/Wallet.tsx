"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { animate } from "motion/react";
import { Notice } from "./Frame";
import { Coin, Streaks, btnInk, btnSoft, glass } from "./Bits";
import { NodeIcon } from "@/components/ui/GitGraph";
import { useCommand } from "./Command";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { EPOCH, RECHARGE_POINTS, STARTER_COINS } from "@/lib/epoch/config";
import type { Tx } from "@/lib/epoch/types";

function Balance({ value }: { value: number }) {
  const [n, setN] = useState(value);
  useEffect(() => { const c = animate(n, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) }); return () => c.stop(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  return <>{n}</>;
}
const ago = (iso: string) => { const s = (Date.now() - new Date(iso).getTime()) / 1000; return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} hours ago` : new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); };
const kindOf = (t: Tx) => t.ref === "ticket" ? { s: "diamond", c: "blue", tag: "Ticket" } : t.ref.startsWith("booth:recharge") ? { s: "triangle", c: "green", tag: "Recharge" } : t.ref.startsWith("booth:") ? { s: "ring", c: "purple", tag: "Booth" } : t.ref.startsWith("reward:") ? { s: "square", c: "mint", tag: "Merch" } : { s: "diamond", c: "purple", tag: "Award" };

/* GitHub-dashboard mood: a soft “Howdy”, a glass feed with fading edges, a Quick access column. */
export function Wallet() {
  const { store, me, ready, refresh } = useEpoch(); const router = useRouter(); const { open } = useCommand();
  const [tx, setTx] = useState<Tx[]>([]);
  const [now, setNow] = useState(""); const [tab, setTab] = useState<"feed" | "recharge">("feed");

  useEffect(() => { if (store && me) store.history().then(setTx); }, [store, me]);
  useEffect(() => { if (!me) return; const i = setInterval(() => void refresh(), 4000); return () => clearInterval(i); }, [me, refresh]);
  useEffect(() => { const f = () => setNow(new Date().toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })); f(); const i = setInterval(f, 30000); return () => clearInterval(i); }, []);

  if (!ready) return <div className="min-h-screen" />;
  if (!me) return (
    <div className="mx-auto grid min-h-screen max-w-[720px] place-items-center px-6 text-center"><div>
      <h1 className="text-[clamp(48px,8vw,96px)] font-medium leading-none tracking-[-0.05em]">No wallet yet.</h1>
      <p className="mx-auto mb-8 mt-5 max-w-[40ch] text-[19px] text-mute">Create a profile to get your pass and QR code.</p><Link href="/epoch/register" className={btnInk}>Get your ticket</Link>
    </div></div>
  );

  const used = new Set(tx.filter((t) => t.ref.startsWith("booth:recharge-")).map((t) => t.ref.slice(6)));
  const left = RECHARGE_POINTS.filter((p) => !used.has(p.id)).length;

  return (
    <div className="relative">
      <Streaks className="fixed -z-0" />
      <div className="relative mx-auto grid w-full max-w-[1180px] gap-10 px-6 pb-24 pt-28 md:px-10 xl:grid-cols-[minmax(0,660px)_260px] xl:justify-between">
        <div>
          <div className="text-center xl:text-left">
            <h1 className="bg-gradient-to-b from-ink/70 to-ink/20 bg-clip-text text-[clamp(64px,10vw,120px)] font-medium leading-none tracking-[-0.06em] text-transparent">Howdy, {me.name.split(" ")[0]}</h1>
            <p className="mt-3 text-[15px] text-mute">{now}</p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {(["feed", "recharge"] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={`rounded-full border px-5 py-2.5 text-[15px] transition ${tab === k ? "border-white/90 bg-white/80 shadow-[0_8px_30px_-14px_rgba(70,45,130,.45)]" : "border-transparent text-mute hover:text-ink"}`}>{k === "feed" ? "Activity" : `Recharge · ${left} left`}</button>)}
            <span className="ml-auto text-[14px] text-mute">✦ Based on your ledger</span>
          </div>

          {/* balance card */}
          <section className={`${glass} mt-5 p-7 sm:p-9`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-mute">@{me.handle}</span>
              <span className={`rounded-full px-3.5 py-1 text-[13px] ${me.ticket ? "bg-ink text-white" : "bg-ink/[.07] text-mute"}`}>{me.ticket ? "Ticket verified" : "Ticket pending"}</span>
            </div>
            <div className="mt-8 flex items-end justify-between gap-6">
              <div><p className="text-[14px] text-mute">Balance</p><p className="flex items-center gap-4 text-[clamp(72px,12vw,132px)] font-medium leading-none tracking-[-0.06em]"><Coin size={72} /><Balance value={me.coins} /></p></div>
              <div className="hidden shrink-0 rounded-2xl bg-white p-2.5 shadow-sm sm:block"><QRCodeSVG value={qr.user(me.id)} size={118} level="M" /><p className="mt-1.5 text-center text-[11px] text-mute">Show at desk</p></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/epoch/scan" className={btnInk}>Scan a booth</Link><button onClick={open} className={btnSoft}>Search <kbd className="rounded-md border border-hair px-1.5 font-mono text-[12px] text-mute">/</kbd></button>
              <button className={btnSoft} onClick={async () => { await store?.signOut(); await refresh(); router.push("/epoch"); }}>Sign out</button>
            </div>
          </section>

          {!me.ticket && <div className="mt-4"><Notice kind="info">One step left: pay your ₹{EPOCH.ticketPriceINR} ticket{EPOCH.ticketUrl ? <> <a className="underline" href={EPOCH.ticketUrl} target="_blank" rel="noopener">here</a></> : " at the registration desk"} and show your QR. {STARTER_COINS} {EPOCH.currency} appear here within seconds.</Notice></div>}

          {/* feed */}
          <div className="mask-fade-b mt-5 space-y-4">
            {tab === "feed" && (tx.length === 0
              ? <div className={`${glass} p-7 text-mute`}>Nothing yet. Scan a recharge point to get your first entry.</div>
              : tx.map((t) => { const k = kindOf(t); return (
                <article key={t.id} className={`${glass} flex items-center gap-5 p-5 sm:p-6`}>
                  <NodeIcon shape={k.s as never} color={k.c as never} size={44} />
                  <div className="min-w-0 flex-1"><p className="truncate text-[19px] font-medium tracking-[-0.02em]">{t.reason}</p><p className="text-[14px] text-mute">{k.tag} · {ago(t.at)}</p></div>
                  <span className="text-[24px] font-medium tabular-nums tracking-[-0.03em]">{t.delta > 0 ? "+" : "−"}{Math.abs(t.delta)}</span>
                </article>); }))}
            {tab === "recharge" && RECHARGE_POINTS.map((p) => (
              <article key={p.id} className={`${glass} flex items-center gap-5 p-5 sm:p-6 ${used.has(p.id) ? "opacity-50" : ""}`}>
                <NodeIcon shape="triangle" color="green" size={44} />
                <div className="min-w-0 flex-1"><p className="text-[19px] font-medium tracking-[-0.02em]">{p.name}</p><p className="text-[14px] text-mute">{used.has(p.id) ? "Used" : "Available · one attempt"}</p></div>
                <span className="text-[22px] font-medium">{used.has(p.id) ? "✓" : `+${p.coins}`}</span>
              </article>))}
          </div>
        </div>

        {/* Quick access */}
        <aside className="hidden xl:block">
          <div className="sticky top-28">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-[16px] font-medium">Quick access</h2><span className="text-mute">···</span></div>
            <ul className="space-y-1">
              {RECHARGE_POINTS.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 text-[14px]"><span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${used.has(p.id) ? "bg-ink/10 text-mute" : "bg-gold/70 text-ink"}`}>{used.has(p.id) ? "✓" : "+"}</span><span className={`truncate ${used.has(p.id) ? "text-mute line-through" : ""}`}>{p.name.replace(" Point", "")}</span></li>
              ))}
            </ul>
            <div className="mt-6 space-y-1 border-t border-hair pt-4 text-[14px]">
              {[["Merch shop", "/epoch/shop"], ["Leaderboard", "/epoch/leaderboard"], ["The plan", "/epoch#plan"]].map(([l, h]) => <Link key={h} href={h} className="block rounded-2xl px-2 py-2.5 text-mute transition hover:bg-white/50 hover:text-ink">{l}</Link>)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
