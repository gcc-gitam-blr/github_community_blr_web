"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Frame, Notice } from "./Frame";
import { Coin, btnEpoch, mono } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { EPOCH } from "@/lib/epoch/config";

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
    await refresh(); router.push("/epoch/wallet?welcome=1");
  };

  const input = "w-full border-b-2 border-ink/20 bg-transparent py-3 text-xl outline-none transition focus:border-epoch-line";
  return (
    <Frame kicker="// register" title={<>Join the <span className="text-epoch-line">fest</span>.</>}>
      <div className="grid md:grid-cols-2">
        <form onSubmit={submit} className="space-y-8 border-b border-epoch-line/70 p-6 sm:p-10 md:border-b-0 md:border-r" noValidate>
          {me && <Notice kind="ok">You&apos;re already in as @{me.handle}. <a className="underline" href="/epoch/wallet">Open wallet →</a></Notice>}
          {!remote && <label className="block"><span className={`${mono} text-ink-3`}>GitHub handle</span><input className={input} value={f.handle} onChange={set("handle")} placeholder="@your-handle" autoComplete="off" /></label>}
          <label className="block"><span className={`${mono} text-ink-3`}>Display name</span><input className={input} value={f.name} onChange={set("name")} placeholder="Ada Lovelace" autoComplete="name" /></label>
          {!remote && <label className="block"><span className={`${mono} text-ink-3`}>Email</span><input className={input} type="email" value={f.email} onChange={set("email")} placeholder="you@college.edu" autoComplete="email" /></label>}
          {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
          <button disabled={busy || !store} className={`${btnEpoch} w-full py-4`}>{busy ? "Working…" : remote ? "Continue with GitHub ↗" : `Claim ${EPOCH.welcomeCoins} ${EPOCH.currency} ↗`}</button>
          <p className="text-sm text-ink-3">{remote ? "We use GitHub sign-in so nobody can register twice." : "Demo mode: your wallet lives in this browser. Connect Supabase for the live fest."}</p>
        </form>
        <div className="grid place-items-center gap-5 bg-epoch/40 p-10 text-center">
          <Coin size={140} spin />
          <p className="font-display text-[clamp(48px,7vw,88px)] font-black leading-none tracking-tighter">+{EPOCH.welcomeCoins}</p>
          <p className={`${mono} text-ink-2`}>{EPOCH.currency} on sign-up</p>
        </div>
      </div>
    </Frame>
  );
}
