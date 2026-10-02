"use client";
import { useRef, useState } from "react";
import { CLUB } from "@/lib/config";
import { EMAIL_RE, HANDLE_RE, cleanHandle, type JoinResult } from "@/lib/join";

/* Club sign-up, shaped like a pull request. Checks the GitHub handle live, lights the
   commit-line dots as each step completes, then saves the sign-up via /api/join
   (falling back to the club's form link or email when no database is connected). */
/* milliseconds since a stamp, measured on the visitor's own clock (never compared with the server's) */
const stamp = () => performance.now() || 1;
const since = (t: number) => (t ? performance.now() - t : undefined);
const IDLE = "No password needed — we only need to know who to welcome.";

export function JoinCard() {
  const [handle, setHandle] = useState(""); const [email, setEmail] = useState(""); const [track, setTrack] = useState("");
  const [handleOk, setHandleOk] = useState(false); const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const [hint, setHint] = useState<{ t: string; k: "" | "good" | "bad" }>({ t: IDLE, k: "" });
  const [errs, setErrs] = useState<Record<string, number>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const startedAt = useRef(0); const honeypot = useRef<HTMLInputElement>(null);

  const emailOk = EMAIL_RE.test(email.trim());
  const steps = [handleOk, emailOk, !!track];
  const fill = (Math.max(0, steps.filter(Boolean).length - 1) / 2) * 100;

  // check the handle against GitHub as the person types (debounced)
  const onHandle = (raw: string) => {
    setHandle(raw); if (!startedAt.current) startedAt.current = stamp();
    clearTimeout(timer.current); setHandleOk(false); setAvatar("");
    const v = cleanHandle(raw);
    if (!v) { setHint({ t: IDLE, k: "" }); return; }
    if (!HANDLE_RE.test(v)) { setHint({ t: "That doesn't look like a GitHub username.", k: "bad" }); return; }
    setHint({ t: "Looking you up on GitHub…", k: "" });
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(v)}`);
        if (res.status === 404) return setHint({ t: "No GitHub user with that name — check the spelling?", k: "bad" });
        if (!res.ok) throw new Error();
        const u = await res.json();
        setAvatar(`${u.avatar_url}&s=60`); setHandleOk(true); setHint({ t: `Found you, ${u.name || u.login}! ✓`, k: "good" });
      } catch { setHandleOk(true); setHint({ t: "Couldn't reach GitHub, but that format looks good.", k: "" }); }
    }, 450);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = [["handle", handleOk], ["email", emailOk], ["track", !!track]].filter(([, ok]) => !ok).map(([k]) => k as string);
    if (bad.length) { setErrs(Object.fromEntries(bad.map((k) => [k, Date.now()]))); setHint({ t: "Almost there — complete all three steps first.", k: "bad" }); return; }
    const h = cleanHandle(handle);
    const first = CLUB.events.find((ev) => ev.date === track)?.title;

    const elapsedMs = since(startedAt.current); // time spent on the form
    setBusy(true);
    let res: JoinResult;
    try {
      const r = await fetch("/api/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: h, email, firstEvent: track, website: honeypot.current?.value, elapsedMs }) });
      res = await r.json();
    } catch { res = { ok: false, error: "Network error.", fallback: true }; }
    setBusy(false);

    if (res.ok) {
      setDone(true);
      setHint({ t: res.status === "exists" ? `You're already on the list, @${h} — see you at the next event.` : `Merged! Welcome to the club, @${h}. We'll email you before ${first}.`, k: "good" });
      return;
    }
    if (!res.fallback) { setHint({ t: res.error, k: "bad" }); return; }

    // no database connected yet: use the club's form link or email instead
    if (CLUB.joinUrl) {
      window.open(CLUB.joinUrl, "_blank", "noopener");
      setHint({ t: `Almost done, @${h} — join the club WhatsApp community in the tab that just opened.`, k: "good" });
    } else if (CLUB.email) {
      const body = `Hi! I'd like to join.\n\nGitHub: @${h}\nEmail: ${email}\nI want to try first: ${first}`;
      window.location.assign(`mailto:${CLUB.email}?subject=${encodeURIComponent("Join GitHub Community Club BLR")}&body=${encodeURIComponent(body)}`);
      setHint({ t: `Thanks, @${h} — send the email that just opened and we'll be in touch.`, k: "good" });
    } else { // nothing configured: say so rather than pretend it was sent
      setHint({ t: "Sign-ups aren't connected yet — the club will open them soon. Follow the events below.", k: "bad" });
    }
  };

  const row = (key: string, ok: boolean, children: React.ReactNode) => (
    <label key={`${key}${errs[key] ?? ""}`} className={`relative flex items-center gap-3.5 border-b border-line py-4 pl-[34px] last:border-0 ${errs[key] ? "animate-[shake_.4s]" : ""}`}>
      <span aria-hidden className={`absolute left-0 top-1/2 h-[17px] w-[17px] -translate-y-1/2 rounded-full border-2 transition-[scale,background-color,border-color] duration-200 ease-out ${ok ? "scale-75 border-ink bg-ink" : errs[key] ? "border-red-500 bg-white" : "border-[#c9ceca] bg-white"}`} />
      {children}
    </label>
  );
  const input = "min-w-0 flex-1 bg-transparent py-1 text-[17px] outline-none placeholder:text-[#a3a8a5]";

  return (
    <form onSubmit={submit} noValidate className="relative rounded-[18px] border border-line bg-white p-8 shadow-[0_30px_80px_-30px_rgba(11,11,15,.25)] md:p-10">
      {/* joining, as a pull request into the club */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#2ea043]" aria-hidden>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="#fff"><path d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9.573.677A.25.25 0 0110 .854V2.5h1A2.5 2.5 0 0113.5 5v5.628a2.251 2.251 0 11-1.5 0V5a1 1 0 00-1-1h-1v1.646a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354z" /></svg>
          </span>
          <h2 className="text-[30px]">Join the club <span className="font-sans text-[20px] font-normal text-ink-3">#new</span></h2>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[12.5px] text-ink-3">
          wants to merge into
          <span className="rounded-md bg-[#ddf4ff] px-2 py-0.5 text-link">club:main</span>from
          <span className="break-all rounded-md bg-[#ddf4ff] px-2 py-0.5 text-link">{cleanHandle(handle) || "you"}:first-commit</span>
        </p>
      </div>
      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-1 before:absolute before:bottom-[30px] before:left-2 before:top-[30px] before:w-0.5 before:bg-line after:absolute after:left-2 after:top-[30px] after:w-0.5 after:bg-ink after:transition-transform after:duration-300 after:ease-out after:h-[calc(100%-60px)] after:origin-top after:[transform:scaleY(var(--f))]" style={{ "--f": fill / 100 } as React.CSSProperties}>
        {row("handle", handleOk, <>
          <span className="sr-only">GitHub username</span><span className="-mr-2 text-ink-3">@</span>
          <input className={input} value={handle} onChange={(e) => onHandle(e.target.value)} placeholder="your-github-handle" autoComplete="off" spellCheck={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatar && <img src={avatar} alt="" className="h-[30px] w-[30px] rounded-full border-2 border-ink" />}
        </>)}
        {row("email", emailOk, <><span className="sr-only">Email</span><input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" autoComplete="email" /></>)}
        {row("track", !!track, <>
          <span className="sr-only">What you want to try first</span>
          <select className={`${input} w-full cursor-pointer appearance-none truncate ${track ? "" : "text-ink-3"}`} value={track} onChange={(e) => setTrack(e.target.value)}>
            <option value="" disabled>What do you want to try first?</option>
            {CLUB.events.map((ev) => <option key={ev.date} value={ev.date}>{ev.title}</option>)}
          </select>
        </>)}
      </div>
      <p role="status" aria-live="polite" className={`mb-5 ml-[34px] mt-3.5 min-h-[1.6em] text-[13.5px] ${hint.k === "bad" ? "text-red-600" : hint.k === "good" ? "font-semibold text-green-700" : "text-ink-3"}`}>{hint.t}</p>
      <p className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13.5px] ${steps.every(Boolean) ? "border-[#2ea043]/40 bg-[#dafbe1] text-[#1a7f37]" : "border-line bg-soft text-ink-3"}`}>
        <span aria-hidden>{steps.every(Boolean) ? "✓" : "○"}</span>
        {steps.every(Boolean) ? "All checks passed — able to merge." : `${steps.filter((s) => !s).length} of 3 checks pending`}
      </p>
      {/* honeypot: hidden from people, irresistible to bots */}
      <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <button disabled={busy || done} className="lift w-full rounded-md border-2 border-ink bg-[#1a7f37] py-5 font-display text-lg font-bold text-white disabled:opacity-70">
        {done ? "✓ Merged" : busy ? "Merging…" : "Merge pull request"}
      </button>
      <p className="mt-4 text-[13px] text-ink-3">We&apos;ll only use this to contact you about club events. <a href="/privacy" className="underline underline-offset-2">Privacy</a></p>
    </form>
  );
}
