"use client";
import { useMemo, useState } from "react";
import { certificateExtras, eventByDate } from "@/lib/certificates";
import { CERT_NOTE_MAX, CERT_SUBJECT_MAX, certSubject, certificateEmail, noteProblem } from "@/lib/email/templates";
import { btnSoft, card, head, input } from "./kit";

/* The certificate email, before it goes: the team's own message for this send (a festival wish, a word about the day)
   and the subject, with a live preview of exactly what people will get. Drafts are kept per event on this device, so a
   message written today is still there when you come back to send the rest. */
export type CertMsg = { note: string; subject: string };
const KEY = (event: string) => `cert-msg:${event}`;
export function loadMsg(event: string): CertMsg {
  try { const j = JSON.parse(localStorage.getItem(KEY(event)) ?? "null"); if (j && typeof j.note === "string" && typeof j.subject === "string") return j; } catch { /* nothing saved */ }
  return { note: "", subject: "" };
}
export function saveMsg(event: string, m: CertMsg) { try { if (m.note || m.subject) localStorage.setItem(KEY(event), JSON.stringify(m)); else localStorage.removeItem(KEY(event)); } catch { /* this visit only */ } }

// starting points to pick and make your own: {name} and {event} fill themselves in; a [word] in brackets is yours to fill
const STARTERS: [string, string][] = [
  ["Festival wish", "Happy [festival], {name}! Wishing you and your family a joyful one.\n\nAnd congratulations: by coming to {event}, you made your first move with Git and GitHub. The first one is the hardest, and it's done."],
  ["First move", "{name}, you made your first move. Most people only think about learning Git; you sat down and did it.\n\nThe next step is a pull request to a real project, and we'll be right there for that one too."],
  ["Thank you", "Thank you for spending your time with us, {name}. Questions you didn't get to ask at {event}? Reply to this email: a real person on the team reads every one."],
  ["Exam season", "All the best for your exams, {name}. When they're over, we'll be here: the next session builds on exactly what you did at {event}."],
];

export function CertEmail({ event, sample, value, onChange }: { event: string; sample: string; value: CertMsg; onChange: (m: CertMsg) => void }) {
  const [open, setOpen] = useState(false);
  const ev = eventByDate(event);
  const problem = noteProblem(value.note.trim(), value.subject.trim());
  const mail = useMemo(() => {
    if (!ev || typeof window === "undefined") return null;
    const site = window.location.origin;
    return certificateEmail({ name: sample, eventTitle: ev.title, url: `${site}/certificates/sample`, linkedin: "https://www.linkedin.com/profile/add", site, ...certificateExtras(ev, site), note: value.note, subject: value.subject });
  }, [ev, sample, value.note, value.subject]);
  if (!ev) return null;
  const set = (m: Partial<CertMsg>) => onChange({ ...value, ...m });
  return (
    <section className={card} aria-labelledby="certmail-h">
      <div className={head}>
        <h2 id="certmail-h" className="text-[18px]">The email</h2>
        <span className="text-[13.5px] text-ink-3">{value.note.trim() ? "With your message" : "The standard one"}{value.subject.trim() ? ", your subject" : ""}</span>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className={`${btnSoft} ml-auto`}>{open ? "Hide" : "Write a message and preview"}</button>
      </div>
      {open && (
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <label className="block text-[14px] font-semibold">Subject <span className="font-normal text-ink-3">(optional)</span>
              <input value={value.subject} maxLength={CERT_SUBJECT_MAX} onChange={(e) => set({ subject: e.target.value })} placeholder={certSubject(ev.title)} className={`${input} mt-1 font-normal`} />
            </label>
            <div>
              <label htmlFor="cert-note" className="text-[14px] font-semibold">Your message <span className="font-normal text-ink-3">(optional, right under the greeting)</span></label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {STARTERS.map(([label, text]) => <button key={label} type="button" onClick={() => set({ note: text })} className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-2 transition-colors duration-150 hover:border-ink/40 hover:text-ink">{label}</button>)}
              </div>
              <textarea id="cert-note" value={value.note} maxLength={CERT_NOTE_MAX} onChange={(e) => set({ note: e.target.value })} rows={7}
                placeholder={"Happy Dussehra, {name}! Wishing you and your family a joyful one…"} className={`${input} mt-2 font-normal leading-relaxed`} />
              <p className="mt-1 flex flex-wrap justify-between gap-2 text-[12.5px] text-ink-3">
                <span><code>{"{name}"}</code> becomes each person&apos;s first name, <code>{"{event}"}</code> the event. A blank line starts a new paragraph.</span>
                <span>{value.note.length} / {CERT_NOTE_MAX}</span>
              </p>
              {problem && <p role="alert" className="mt-2 text-[13.5px] font-semibold text-[#9a6700]">{problem}</p>}
              {(value.note || value.subject) && <button type="button" onClick={() => onChange({ note: "", subject: "" })} className="mt-2 text-[13px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">Back to the standard email</button>}
            </div>
            <p className="text-[13px] text-ink-3">Saved on this device for this event, and used for every send and re-send below until you change it.</p>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-ink-3">What <b className="text-ink">{sample}</b> will get{sample === "Ada Lovelace" ? " (a sample name)" : ""}:</p>
            <p className="mt-1 truncate rounded-t-md border border-b-0 border-line bg-soft px-3 py-2 text-[13.5px]"><span className="text-ink-3">Subject:</span> <b>{mail?.subject}</b></p>
            {/* the real email, sandboxed: nothing in it can run */}
            <iframe title="Email preview" sandbox="" srcDoc={mail?.html ?? ""} className="h-[620px] w-full rounded-b-md border border-line bg-white" />
          </div>
        </div>
      )}
    </section>
  );
}
