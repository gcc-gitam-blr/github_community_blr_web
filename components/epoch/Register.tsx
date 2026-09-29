"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Frame, Notice } from "./Frame";
import { btnInk, field, glass, label } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { EPOCH, STARTER_COINS } from "@/lib/epoch/config";

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
    <Frame title="Get your ticket." sub={`Create a profile, pay ₹${EPOCH.ticketPriceINR}, and show your QR at the desk. ${STARTER_COINS} ${EPOCH.currency} land in your wallet.`}>
      <form onSubmit={submit} noValidate className={`${glass} mx-auto max-w-[560px] space-y-6 p-8 sm:p-10`}>
        {me && <Notice kind="ok">You&apos;re already in as @{me.handle}. <Link className="underline" href="/epoch/wallet">Open wallet</Link></Notice>}
        {!remote && <label className="block"><span className={`${label} mb-2 block`}>GitHub handle</span><input className={field} value={f.handle} onChange={set("handle")} placeholder="@your-handle" autoComplete="off" /></label>}
        <label className="block"><span className={`${label} mb-2 block`}>Name</span><input className={field} value={f.name} onChange={set("name")} placeholder="Ada Lovelace" autoComplete="name" /></label>
        {!remote && <label className="block"><span className={`${label} mb-2 block`}>Email</span><input className={field} type="email" value={f.email} onChange={set("email")} placeholder="you@gitam.in" autoComplete="email" /></label>}
        {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
        <button disabled={busy || !store} className={`${btnInk} w-full`}>{busy ? "Working…" : remote ? "Continue with GitHub" : "Create my profile"}</button>
        <p className="text-sm text-mute">{remote ? "GitHub sign-in means nobody can register twice." : "Demo mode: your wallet lives in this browser."} Ticket price is a working figure until the final one is announced.</p>
      </form>
    </Frame>
  );
}
