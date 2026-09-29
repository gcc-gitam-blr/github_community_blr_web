"use client";
import { useEffect, useRef, useState } from "react";
import { CLUB } from "@/lib/config";

/* Club sign-up. Checks the GitHub handle live, lights the commit-line dots
   as each step completes, then opens a pre-filled email to the club. */
export function JoinCard() {
  const [handle, setHandle] = useState(""); const [email, setEmail] = useState(""); const [track, setTrack] = useState("");
  const [handleOk, setHandleOk] = useState(false); const [avatar, setAvatar] = useState(""); const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<{ t: string; k: "" | "good" | "bad" }>({ t: "No password needed — we only need to know who to welcome.", k: "" });
  const [errs, setErrs] = useState<Record<string, number>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const steps = [handleOk, emailOk, !!track];
  const fill = (Math.max(0, steps.filter(Boolean).length - 1) / 2) * 100;

  useEffect(() => {
    clearTimeout(timer.current); setHandleOk(false); setAvatar("");
    const v = handle.trim().replace(/^@/, "");
    if (!v) { setHint({ t: "No password needed — we only need to know who to welcome.", k: "" }); return; }
    if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(v)) { setHint({ t: "That doesn't look like a GitHub username.", k: "bad" }); return; }
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
    return () => clearTimeout(timer.current);
  }, [handle]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const bad = [["handle", handleOk], ["email", emailOk], ["track", !!track]].filter(([, ok]) => !ok).map(([k]) => k as string);
    if (bad.length) { setErrs(Object.fromEntries(bad.map((k) => [k, Date.now()]))); setHint({ t: "Almost there — complete all three steps first.", k: "bad" }); return; }
    const h = handle.replace(/^@/, "");
    const first = CLUB.events.find((ev) => ev.date === track)?.title;
    if (CLUB.joinUrl) { // the club's own sign-up form or community link
      window.open(CLUB.joinUrl, "_blank", "noopener");
      setHint({ t: `Almost done, @${h} — finish signing up in the tab that just opened.`, k: "good" });
    } else if (CLUB.email) {
      const body = `Hi! I'd like to join.\n\nGitHub: @${h}\nEmail: ${email}\nI want to try first: ${first}`;
      window.location.href = `mailto:${CLUB.email}?subject=${encodeURIComponent("Join GitHub Community Club BLR")}&body=${encodeURIComponent(body)}`;
      setHint({ t: `Thanks, @${h} — send the email that just opened and we'll be in touch.`, k: "good" });
    } else { // nothing configured yet: say so rather than pretend it was sent
      setHint({ t: "Sign-ups aren't connected yet — the club will open them soon. Follow the events below.", k: "bad" });
    }
  };

  const row = (key: string, ok: boolean, children: React.ReactNode) => (
    <label key={`${key}${errs[key] ?? ""}`} className={`relative flex items-center gap-3.5 border-b border-line py-4 pl-[34px] last:border-0 ${errs[key] ? "animate-[shake_.4s]" : ""}`}>
      <span aria-hidden className={`absolute left-0 top-1/2 h-[17px] w-[17px] -translate-y-1/2 rounded-full border-2 transition-all ${ok ? "scale-75 border-ink bg-ink" : errs[key] ? "border-red-500 bg-white" : "border-[#c9ceca] bg-white"}`} />
      {children}
    </label>
  );
  const input = "min-w-0 flex-1 bg-transparent py-1 text-[17px] outline-none placeholder:text-[#a3a8a5]";

  return (
    <form onSubmit={submit} noValidate className="rounded-[18px] border border-line bg-white p-8 shadow-[0_30px_80px_-30px_rgba(11,11,15,.25)] md:p-10">
      <div className="mb-6 flex items-center gap-[18px]">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-ink" aria-hidden>
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M6 3v11M6 9c0 5 8 1 8 6M14 3v4M12 5h4" /></svg>
        </span>
        <h2 className="text-[34px]">Get started</h2>
      </div>
      <div className="relative grid gap-1 before:absolute before:bottom-[30px] before:left-2 before:top-[30px] before:w-0.5 before:bg-line after:absolute after:left-2 after:top-[30px] after:w-0.5 after:bg-ink after:transition-all after:duration-500 after:[height:calc((100%-60px)*var(--f))]" style={{ "--f": fill / 100 } as React.CSSProperties}>
        {row("handle", handleOk, <>
          <span className="sr-only">GitHub username</span><span className="-mr-2 text-ink-3">@</span>
          <input className={input} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="your-github-handle" autoComplete="off" spellCheck={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatar && <img src={avatar} alt="" className="h-[30px] w-[30px] rounded-full border-2 border-ink" />}
        </>)}
        {row("email", emailOk, <><span className="sr-only">Email</span><input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" autoComplete="email" /></>)}
        {row("track", !!track, <>
          <span className="sr-only">What you want to try first</span>
          <select className={`${input} cursor-pointer appearance-none ${track ? "" : "text-ink-3"}`} value={track} onChange={(e) => setTrack(e.target.value)}>
            <option value="" disabled>What do you want to try first?</option>
            {CLUB.events.map((ev) => <option key={ev.date} value={ev.date}>{ev.title}</option>)}
          </select>
        </>)}
      </div>
      <p role="status" aria-live="polite" className={`mb-5 ml-[34px] mt-3.5 min-h-[1.6em] text-[13.5px] ${hint.k === "bad" ? "text-red-600" : hint.k === "good" ? "font-semibold text-green-700" : "text-ink-3"}`}>{hint.t}</p>
      <button disabled={busy} className="lift w-full rounded-md border-2 border-brand bg-brand py-5 font-display text-lg font-bold hover:border-ink">Join the club</button>
      <p className="mt-4 text-[13px] text-ink-3">We&apos;ll only use this to contact you about club events.</p>
    </form>
  );
}
