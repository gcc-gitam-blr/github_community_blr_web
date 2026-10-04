"use client";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { BellIcon, CheckIcon, TagIcon } from "@primer/octicons-react";
import { EPOCH } from "@/lib/epoch/config";
import { validateInterest } from "@/lib/interest";

/* "Notify me when Epoch dates are announced", worded like watching a repo for its next release.
   Once the dates are set in the content editor (Epoch → startsAt) it turns into "Dates are out" with the ticket link. */
export function EpochInterest({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "created" | "exists">("idle");
  const [err, setErr] = useState("");
  const honey = useRef<HTMLInputElement>(null);
  const t = dark ? { sub: "text-[#a9b3ad]", field: "border-white/25 bg-white/10 text-white placeholder:text-white/45 focus:border-gold", btn: "bg-gold text-ink hover:bg-gold-soft", ring: "focus-visible:outline-gold", link: "text-gold", err: "text-[#ffb4a8]" }
    : { sub: "text-ink-3", field: "border-line bg-white text-ink placeholder:text-ink-3 focus:border-ink", btn: "bg-ink text-white hover:bg-ink/85", ring: "", link: "text-link", err: "text-red-600" };

  if (EPOCH.startsAt) return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] ${className}`}>
      <span className="inline-flex items-center gap-1.5 font-mono"><TagIcon size={16} className={dark ? "text-gold" : ""} />Dates are out: {EPOCH.dates}</span>
      <Link href="/epoch/register" className={`font-semibold underline-offset-4 hover:underline ${t.link} ${t.ring}`}>Get your ticket →</Link>
    </p>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const input = { email, website: honey.current?.value };
    const bad = validateInterest(input); if (bad && bad !== "spam") return setErr(bad);
    setState("sending");
    try {
      const j = await (await fetch("/api/epoch-interest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })).json();
      if (j.ok) setState(j.status); else { setErr(j.error ?? "Something went wrong."); setState("idle"); }
    } catch { setErr("Network error — please try again."); setState("idle"); }
  };

  if (state === "created" || state === "exists") return (
    <p role="status" className={`flex items-center gap-2 text-[15px] ${className}`}><CheckIcon size={18} className={dark ? "text-gold" : "text-[#1a7f37]"} />{state === "created" ? "Watching. We'll email you when the Epoch dates are out." : "You're already on the list. We'll email you when the dates are out."}</p>
  );

  return (
    <form onSubmit={submit} noValidate className={`relative ${dark ? "md:grid md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-x-5" : ""} ${className}`}>
      <label htmlFor={id} className="flex items-center gap-2 text-[15px] font-semibold"><BellIcon size={16} className={dark ? "text-gold" : ""} />Tell me when the dates are out</label>
      <div className={`mt-2 flex flex-wrap gap-2 ${dark ? "md:mt-0" : ""}`}>
        <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gitam.in" autoComplete="email" aria-describedby={`${id}-note ${id}-err`}
          className={`min-w-0 flex-1 basis-[200px] rounded-md border px-3.5 py-2.5 text-[16px] outline-none transition ${t.field} ${t.ring}`} />
        <button disabled={state === "sending"} className={`rounded-md px-4 py-2.5 font-display text-[15px] font-bold transition disabled:opacity-60 ${t.btn} ${t.ring}`}>{state === "sending" ? "Saving…" : "Watch releases"}</button>
      </div>
      <input ref={honey} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <p id={`${id}-err`} role="alert" className={`mt-2 text-[14px] empty:hidden md:col-start-2 ${t.err}`}>{err}</p>
      <p id={`${id}-note`} className={`mt-2 text-[13px] md:col-start-2 ${t.sub}`}>Only Epoch news, from the club. Every email has an unsubscribe link. <Link href="/privacy" className={`underline underline-offset-2 ${t.ring}`}>Privacy</Link></p>
    </form>
  );
}
