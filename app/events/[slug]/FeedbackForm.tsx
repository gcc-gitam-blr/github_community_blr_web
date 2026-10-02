"use client";
import { useEffect, useRef, useState } from "react";
import { StarFillIcon, StarIcon } from "@primer/octicons-react";
import { todayISO, useClientValue } from "@/lib/useClientValue";
import { validateFeedback } from "@/lib/feedback";

/* "How was it?" — only appears once the event date has passed. Anonymous. */
const area = "w-full rounded-lg border border-line bg-white px-4 py-3 text-[16px] outline-none transition focus:border-ink";

export function FeedbackForm({ date, title }: { date: string; title: string }) {
  const today = useClientValue(todayISO, "");
  const [rating, setRating] = useState(0); const [hover, setHover] = useState(0);
  const [liked, setLiked] = useState(""); const [improve, setImprove] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle"); const [err, setErr] = useState("");
  const started = useRef(0); const honey = useRef<HTMLInputElement>(null);
  useEffect(() => { started.current = Date.now(); }, []); // when the form appeared
  if (!today || date > today) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const body = { event: date, rating, liked, improve, website: honey.current?.value, elapsedMs: Date.now() - started.current };
    const bad = validateFeedback(body); if (bad && bad !== "spam") return setErr(bad);
    setState("sending");
    try {
      const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json(); if (j.ok) setState("done"); else { setErr(j.error ?? "Something went wrong."); setState("idle"); }
    } catch { setErr("Network error — please try again."); setState("idle"); }
  };

  if (state === "done") return <section className="mt-6 rounded-[12px] border-2 border-ink bg-[#dafbe1] p-6" role="status"><h2 className="text-[22px]">Thank you!</h2><p className="mt-1 text-ink-2">Your feedback helps us make the next session better.</p></section>;
  const shown = hover || rating;
  return (
    <form onSubmit={submit} noValidate className="relative mt-6 rounded-[12px] border border-line bg-white p-6 sm:p-8">
      <h2 className="text-[24px]">How was {title}?</h2>
      <p className="mt-1 text-[15px] text-ink-2">Anonymous, and it takes a minute. Honest answers help most.</p>
      <fieldset className="mt-5">
        <legend className="sr-only">Rating</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-1" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" aria-label={`${n} star${n > 1 ? "s" : ""}`} />
              <span className="block text-[#d4a72c] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0969da]">{n <= shown ? <StarFillIcon size={32} /> : <StarIcon size={32} />}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block"><span className="mb-1.5 block text-[14px] font-medium">What did you like?</span><textarea className={area} rows={3} value={liked} onChange={(e) => setLiked(e.target.value)} maxLength={1000} /></label>
      <label className="mt-4 block"><span className="mb-1.5 block text-[14px] font-medium">What should we improve?</span><textarea className={area} rows={3} value={improve} onChange={(e) => setImprove(e.target.value)} maxLength={1000} /></label>
      <input ref={honey} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <p role="alert" className="mt-3 min-h-[1.4em] text-[14.5px] text-red-600">{err}</p>
      <button disabled={state === "sending"} className="mt-1 rounded-md bg-ink px-5 py-3 font-display font-bold text-white disabled:opacity-60">{state === "sending" ? "Sending…" : "Send feedback"}</button>
    </form>
  );
}
