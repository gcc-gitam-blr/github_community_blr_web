"use client";
import { useEffect, useRef, useState } from "react";
import { LIMITS, cleanAnswers, validateApplication, type Answer, type OpenCampaign, type Question } from "@/lib/apply";

/* Core-team applications: the open round's own form (built in Admin → Recruitment, like a Google Form), or a short
   "closed" note when no round is open. Shown on /apply and inside Get involved when "Join the core team" is picked. */
const field = "w-full rounded-lg border border-line bg-white px-4 py-3 text-[16px] outline-none transition-colors focus:border-ink";
const niceDate = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
const optional = <span className="font-normal text-ink-3"> (optional)</span>;

/** One question, drawn the way its type asks: a line, a box, choices, boxes to tick, a list, or a 1-to-5 scale. */
function Field({ q, value, set }: { q: Question; value: Answer | undefined; set: (v: Answer) => void }) {
  const id = `q-${q.id}`, help = q.help ? <span className="mb-2 block text-[14px] text-ink-3">{q.help}</span> : null;
  const label = <>{q.label}{!q.required && optional}</>;
  if (q.type === "choice" || q.type === "checkboxes" || q.type === "scale") {
    const many = q.type === "checkboxes", options = q.type === "scale" ? ["1", "2", "3", "4", "5"] : q.options ?? [];
    const on = (o: string) => (many ? (Array.isArray(value) ? value : []).includes(o) : value === o);
    const toggle = (o: string) => (many ? set(on(o) ? (value as string[]).filter((x) => x !== o) : [...(Array.isArray(value) ? value : []), o]) : set(o));
    return (
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-[14px] font-medium">{label}</legend>{help}
        <div className={`flex flex-wrap gap-2 ${q.type === "scale" ? "" : "flex-col sm:flex-row"}`}>
          {options.map((o) => (
            <label key={o} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-4 py-2.5 text-[15.5px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-link ${on(o) ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"}`}>
              <input type={many ? "checkbox" : "radio"} name={id} value={o} checked={on(o)} onChange={() => toggle(o)} className="sr-only" />{o}
            </label>
          ))}
        </div>
        {q.type === "scale" && <span className="mt-1.5 block text-[13px] text-ink-3">1 is the least, 5 the most.</span>}
      </fieldset>
    );
  }
  const text = typeof value === "string" ? value : "";
  return (
    <label htmlFor={id} className={`block ${q.type === "long" ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-[14px] font-medium">{label}</span>{help}
      {q.type === "long" ? <textarea id={id} className={field} rows={4} value={text} onChange={(e) => set(e.target.value)} maxLength={LIMITS.answer} />
        : q.type === "dropdown" ? <select id={id} className={field} value={text} onChange={(e) => set(e.target.value)}><option value="">Choose…</option>{(q.options ?? []).map((o) => <option key={o}>{o}</option>)}</select>
        : <input id={id} className={field} value={text} onChange={(e) => set(e.target.value)} maxLength={LIMITS.short} inputMode={q.type === "link" ? "url" : undefined} placeholder={q.type === "link" ? "github.com/you" : undefined} />}
    </label>
  );
}

export function ApplyForm() {
  const [round, setRound] = useState<OpenCampaign | null | undefined>(undefined); // undefined = still asking
  const [v, setV] = useState({ name: "", email: "", handle: "", team: "" });
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "exists">("idle");
  const [err, setErr] = useState("");
  const started = useRef(0); const honey = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/apply").then((r) => r.json()).then((j) => { if (live) setRound(j.open ? j.campaign : null); }).catch(() => { if (live) setRound(null); });
    return () => { live = false; };
  }, []);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  if (round === undefined) return <p className="mt-6 text-ink-3" aria-busy="true">Checking whether applications are open…</p>;
  if (round === null) return (
    <div role="status" className="mt-6 rounded-xl border border-line bg-[#f6f8fa] p-5">
      <h2 className="text-[22px]">Applications are closed right now</h2>
      <p className="mt-2 text-[16px] text-ink-2">We open a round when the core team is growing, and announce it on WhatsApp and Instagram. Until then, say hello through <a href="/get-involved" className="underline underline-offset-2">Get involved</a>.</p>
    </div>
  );
  if (state === "done" || state === "exists") return (
    <div role="status" className="mt-6 rounded-[18px] border-2 border-ink bg-[#dafbe1] p-6">
      <h2 className="text-[26px]">{state === "exists" ? "You've already applied" : "Application sent. Thank you!"}</h2>
      <p className="mt-2 text-[16px] text-ink-2">{state === "exists" ? "We have your application for this round already, so there's nothing more to do." : "The reviewers will read it and get back to you by email. If you gave a working address you'll also get a confirmation."}</p>
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const input = { campaign: round.id, name: v.name, email: v.email, handle: v.handle, team: v.team, answers: cleanAnswers(answers, round.questions), website: honey.current?.value, elapsedMs: started.current ? Date.now() - started.current : undefined };
    const bad = validateApplication(input, round); if (bad && bad !== "spam") return setErr(bad);
    setState("sending");
    try {
      const r = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const j = await r.json();
      if (j.ok) setState(j.status === "exists" ? "exists" : "done");
      else { if (j.closed) setRound(null); setErr(j.error ?? "Something went wrong."); setState("idle"); }
    } catch { setErr("Network error. Please try again."); setState("idle"); }
  };

  return (
    <form onSubmit={submit} onFocus={() => { if (!started.current) started.current = Date.now(); }} noValidate className="relative mt-6">
      <div className="rounded-lg bg-[#dafbe1] px-4 py-3 text-[15px] text-ink-2">
        <p><b className="text-ink">{round.name}</b> is open until {niceDate(round.closesOn)}.</p>
        {round.intro && <p className="mt-1.5 whitespace-pre-line">{round.intro}</p>}
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Your name</span><input className={field} value={v.name} onChange={set("name")} autoComplete="name" /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Email</span><input className={field} type="email" value={v.email} onChange={set("email")} autoComplete="email" /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">GitHub username</span><input className={field} value={v.handle} onChange={set("handle")} autoComplete="username" placeholder="octocat" /></label>
        {round.teams.length > 0 && (
          <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Team you prefer{optional}</span>
            <select className={field} value={v.team} onChange={set("team")}><option value="">No preference</option>{round.teams.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
        )}
        {round.questions.map((q) => <Field key={q.id} q={q} value={answers[q.id]} set={(x) => setAnswers({ ...answers, [q.id]: x })} />)}
      </div>
      <input ref={honey} name="gcc-hp-x" tabIndex={-1} autoComplete="off" aria-hidden hidden />
      <p role="alert" className="mt-4 min-h-[1.5em] text-[14.5px] text-[#a40e26]">{err}</p>
      <button disabled={state === "sending"} className="mt-2 rounded-md bg-ink px-6 py-3.5 font-display font-bold text-white transition-colors hover:bg-ink/85 disabled:opacity-60">{state === "sending" ? "Sending…" : "Send application"}</button>
      <p className="mt-4 text-[13px] text-ink-3">Please don&apos;t include sensitive personal details (health, religion, caste, ID numbers). Only this round&apos;s reviewers and the club&apos;s admins can read your application. <a href="/privacy" className="underline underline-offset-2">Privacy</a></p>
    </form>
  );
}
