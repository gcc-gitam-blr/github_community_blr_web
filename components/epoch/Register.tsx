"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Frame, Notice } from "./Frame";
import { Coin, btnGold, card, field, mono } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { EPOCH, STARTER_COINS } from "@/lib/epoch/config";

const STEPS = [
  ["Create your profile", "Takes a minute. This is where your balance and history will live."],
  [`Pay for your ticket — ₹${EPOCH.ticketPriceINR}`, EPOCH.ticketUrl ? "Use the payment link in your wallet." : "Pay at the registration desk on the day (a payment link will be added here)."],
  ["Show your QR at the desk", `An organiser scans it, verifies the ticket, and ${STARTER_COINS} ${EPOCH.currency} land in your wallet instantly.`],
];

export function Register() {
  const { store, me, refresh } = useEpoch(); const router = useRouter();
  const [f, setF] = useState({ handle: "", name: "", email: "" });
  const [msg, setMsg] = useState<{ k: "err" | "info"; t: string } | null>(null); const [busy, setBusy] = useState(false);
  const remote = store?.mode === "supabase";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return;
    if (!remote && (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(f.handle.replace(/^@/, "")) || !f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email))) return setMsg({ k: "err", t: "Fill in a valid GitHub handle, name and email." });
    if (remote && !f.name.trim()) return setMsg({ k: "err", t: "Pick a display name first." });
    setBusy(true); setMsg(null);
    const r = await store.register(f);
    setBusy(false);
    if (!r.ok) return setMsg({ k: r.error.startsWith("Redirecting") ? "info" : "err", t: r.error });
    await refresh(); router.push("/epoch/wallet");
  };

  return (
    <Frame kicker="// register" title={<>Get your <span className="text-gold">ticket</span>.</>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <form onSubmit={submit} noValidate className={`${card} space-y-6 p-7 sm:p-10`}>
          {me && <Notice kind="ok">You&apos;re already in as @{me.handle}. <Link className="underline" href="/epoch/wallet">Open wallet →</Link></Notice>}
          {!remote && <label className="block"><span className={`${mono} mb-2 block text-fog`}>GitHub handle</span><input className={field} value={f.handle} onChange={set("handle")} placeholder="@your-handle" autoComplete="off" /></label>}
          <label className="block"><span className={`${mono} mb-2 block text-fog`}>Display name</span><input className={field} value={f.name} onChange={set("name")} placeholder="Ada Lovelace" autoComplete="name" /></label>
          {!remote && <label className="block"><span className={`${mono} mb-2 block text-fog`}>Email</span><input className={field} type="email" value={f.email} onChange={set("email")} placeholder="you@gitam.in" autoComplete="email" /></label>}
          {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
          <button disabled={busy || !store} className={`${btnGold} w-full !py-4 text-lg`}>{busy ? "Working…" : remote ? "Continue with GitHub →" : "Create my profile →"}</button>
          <p className="text-sm text-fog/80">{remote ? "GitHub sign-in means nobody can register twice." : "Demo mode: your wallet lives in this browser. Connect Supabase for the live event."}</p>
        </form>

        <div className={`${card} p-7 sm:p-10`}>
          <div className="mb-8 flex items-center gap-4"><Coin size={56} /><div><p className="font-display text-5xl font-black tracking-tighter text-gold">{STARTER_COINS}</p><p className={`${mono} text-fog`}>{EPOCH.currency} · ₹{EPOCH.ticketPriceINR} × {EPOCH.coinsPerINR}</p></div></div>
          <ol className="space-y-6">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-gold/50 font-mono text-sm font-bold text-gold">{i + 1}</span>
                <div><h3 className="font-display text-xl font-bold tracking-tight">{t}</h3><p className="mt-1 text-[15px] text-fog">{d}</p></div>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-xs text-fog/70">Ticket price is a working figure from the plan; the final price will be announced.</p>
        </div>
      </div>
    </Frame>
  );
}
