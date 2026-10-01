"use client";
import { useRef, useState } from "react";
import { KINDS, validateContact, type Kind } from "@/lib/contact";

/* The Get involved form: pick what it's about, then say who you are. */
const field = "w-full rounded-lg border border-line bg-white px-4 py-3 text-[16px] outline-none transition focus:border-ink";

export function ContactForm({ initial = "question" }: { initial?: Kind }) {
  const [kind, setKind] = useState<Kind>(initial);
  const [v, setV] = useState({ name: "", email: "", handle: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");
  const started = useRef(0); const honey = useRef<HTMLInputElement>(null);
  const cur = KINDS.find((k) => k.id === kind)!;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (!started.current) started.current = Date.now(); setV({ ...v, [k]: e.target.value }); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const input = { kind, ...v, website: honey.current?.value, startedAt: started.current };
    const bad = validateContact(input); if (bad && bad !== "spam") return setErr(bad);
    setState("sending");
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const j = await r.json();
      if (j.ok) setState("done"); else { setErr(j.error ?? "Something went wrong."); setState("idle"); }
    } catch { setErr("Network error — please try again."); setState("idle"); }
  };

  if (state === "done") return (
    <div role="status" className="rounded-[18px] border-2 border-ink bg-[#dafbe1] p-8">
      <h2 className="text-[30px]">Message sent — thank you!</h2>
      <p className="mt-2 text-[17px] text-ink-2">A real person will reply, usually within a few days. If you gave your email you&apos;ll also get a confirmation.</p>
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="relative rounded-[18px] border border-line bg-white p-6 shadow-[0_30px_80px_-40px_rgba(11,11,15,.25)] sm:p-8">
      <fieldset>
        <legend className="mb-3 font-mono text-[13px] text-ink-2">What is this about?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <label key={k.id} className={`cursor-pointer rounded-xl border-2 p-3.5 transition ${kind === k.id ? "border-ink bg-[#dafbe1]" : "border-line hover:border-ink/50"}`}>
              <input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} className="sr-only" />
              <span className="block font-semibold">{k.label}</span><span className="mt-0.5 block text-[14px] leading-snug text-ink-2">{k.blurb}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Your name</span><input className={field} value={v.name} onChange={set("name")} autoComplete="name" /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Email</span><input className={field} type="email" value={v.email} onChange={set("email")} autoComplete="email" /></label>
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-[14px] font-medium">GitHub username {kind === "apply" ? "" : <span className="font-normal text-ink-3">(optional)</span>}</span><input className={field} value={v.handle} onChange={set("handle")} placeholder="@your-handle" autoComplete="off" spellCheck={false} /></label>
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-[14px] font-medium">{cur.ask}</span><textarea className={field} rows={6} value={v.message} onChange={set("message")} maxLength={3000} /></label>
      </div>

      <input ref={honey} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <p role="alert" className="mt-4 min-h-[1.5em] text-[14.5px] text-red-600">{err}</p>
      <button disabled={state === "sending"} className="mt-2 rounded-md bg-ink px-6 py-3.5 font-display font-bold text-white transition hover:bg-ink/85 disabled:opacity-60">{state === "sending" ? "Sending…" : "Send message"}</button>
      <p className="mt-4 text-[13px] text-ink-3">We use your details only to reply. <a href="/privacy" className="underline underline-offset-2">Privacy</a></p>
    </form>
  );
}
