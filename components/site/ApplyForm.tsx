"use client";
import { useEffect, useRef, useState } from "react";
import { QUESTIONS, TEAMS, validateApplication, type OpenCampaign } from "@/lib/apply";

/* Core-team applications. Shown inside the Get involved form when "Join the core team" is picked: the application form
   while a round is open, and a short "closed" note otherwise. Same look as the contact form. */
const field = "w-full rounded-lg border border-line bg-white px-4 py-3 text-[16px] outline-none transition focus:border-ink";
const niceDate = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

export function ApplyForm() {
  const [round, setRound] = useState<OpenCampaign | null | undefined>(undefined); // undefined = still asking
  const [v, setV] = useState({ name: "", email: "", handle: "", team: "", why: "", built: "" });
  const [state, setState] = useState<"idle" | "sending" | "done" | "exists">("idle");
  const [err, setErr] = useState("");
  const started = useRef(0); const honey = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/apply").then((r) => r.json()).then((j) => { if (live) setRound(j.open ? j.campaign : null); }).catch(() => { if (live) setRound(null); });
    return () => { live = false; };
  }, []);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { if (!started.current) started.current = Date.now(); setV({ ...v, [k]: e.target.value }); };

  if (round === undefined) return <p className="mt-6 text-ink-3" aria-busy="true">Checking whether applications are open…</p>;
  if (round === null) return (
    <div role="status" className="mt-6 rounded-xl border border-line bg-[#f6f8fa] p-5">
      <h2 className="text-[22px]">Applications are closed right now</h2>
      <p className="mt-2 text-[16px] text-ink-2">We open a round when the core team is growing, and announce it on WhatsApp and Instagram. You can still pick <b>Ask us anything</b> above to say hello.</p>
    </div>
  );
  if (state === "done" || state === "exists") return (
    <div role="status" className="mt-6 rounded-[18px] border-2 border-ink bg-[#dafbe1] p-6">
      <h2 className="text-[26px]">{state === "exists" ? "You've already applied" : "Application sent — thank you!"}</h2>
      <p className="mt-2 text-[16px] text-ink-2">{state === "exists" ? "We have your application for this round already, so there's nothing more to do." : "The reviewers will read it and get back to you by email. If you gave a working address you'll also get a confirmation."}</p>
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const input = { campaign: round.id, name: v.name, email: v.email, handle: v.handle, team: v.team, answers: { why: v.why, built: v.built }, website: honey.current?.value, elapsedMs: started.current ? Date.now() - started.current : undefined };
    const bad = validateApplication(input); if (bad && bad !== "spam") return setErr(bad);
    setState("sending");
    try {
      const r = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const j = await r.json();
      if (j.ok) setState(j.status === "exists" ? "exists" : "done");
      else { if (j.closed) setRound(null); setErr(j.error ?? "Something went wrong."); setState("idle"); }
    } catch { setErr("Network error — please try again."); setState("idle"); }
  };

  return (
    <form onSubmit={submit} noValidate className="relative mt-6">
      <p className="rounded-lg bg-[#dafbe1] px-4 py-3 text-[15px] text-ink-2"><b className="text-ink">{round.name}</b> is open until {niceDate(round.closesOn)}.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Your name</span><input className={field} value={v.name} onChange={set("name")} autoComplete="name" /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Email</span><input className={field} type="email" value={v.email} onChange={set("email")} autoComplete="email" /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">GitHub username</span><input className={field} value={v.handle} onChange={set("handle")} autoComplete="username" placeholder="octocat" /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Team you prefer <span className="font-normal text-ink-3">(optional)</span></span>
          <select className={field} value={v.team} onChange={set("team")}><option value="">No preference</option>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        {QUESTIONS.map((q) => (
          <label key={q.id} className="block sm:col-span-2"><span className="mb-1.5 block text-[14px] font-medium">{q.label} <span className="font-normal text-ink-3">{q.hint}</span></span>
            <textarea className={field} rows={4} value={v[q.id]} onChange={set(q.id)} maxLength={1000} /></label>
        ))}
      </div>
      <input ref={honey} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <p role="alert" className="mt-4 min-h-[1.5em] text-[14.5px] text-red-600">{err}</p>
      <button disabled={state === "sending"} className="mt-2 rounded-md bg-ink px-6 py-3.5 font-display font-bold text-white transition hover:bg-ink/85 disabled:opacity-60">{state === "sending" ? "Sending…" : "Send application"}</button>
      <p className="mt-4 text-[13px] text-ink-3">Please don&apos;t include sensitive personal details (health, religion, caste, ID numbers). Only this round&apos;s reviewers and the club&apos;s admins can read your application. <a href="/privacy" className="underline underline-offset-2">Privacy</a></p>
    </form>
  );
}
