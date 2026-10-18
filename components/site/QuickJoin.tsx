"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon } from "@primer/octicons-react";
import { CLUB } from "@/lib/config";
import { EVENTS, todayInIndia } from "@/lib/events";
import { EMAIL_RE, HANDLE_RE, cleanHandle, type JoinResult } from "@/lib/join";

/* Joining in two steps, the same in the hero and at the bottom of the page.
   1. A name and an email. That's a sign-up: we can welcome them and tell them what's next.
   2. Optional, right after or any time later: their GitHub username (looked up live, with their avatar) and what they'd
      like to try first. Saved with the signed key the first step returned.
   This browser remembers that they joined, so a returning visitor sees "you're in", not the form again. */
type Joined = { name: string; email: string; token?: string; extras?: "done" | "later" };
const KEY = "gcc-joined", EVT = "gcc-joined";
const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
export function useJoined(): [Joined | null, (j: Joined | null) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const joined = useMemo(() => { try { return raw ? (JSON.parse(raw) as Joined) : null; } catch { return null; } }, [raw]);
  const set = (j: Joined | null) => { try { if (j) localStorage.setItem(KEY, JSON.stringify(j)); else localStorage.removeItem(KEY); } catch { /* storage blocked: this visit only */ } window.dispatchEvent(new Event(EVT)); };
  return [joined, set];
}
const firstName = (n: string) => n.trim().split(/\s+/)[0] || "there";

/** Step 1: two fields and a button. `tone` is the hero (inline, on white) or the card at the bottom. */
export function JoinForm({ tone = "hero", onJoined }: { tone?: "hero" | "card"; onJoined?: (j: Joined) => void }) {
  const [, setJoined] = useJoined();
  const [name, setName] = useState(""), [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const started = useRef(0), honey = useRef<HTMLInputElement>(null);
  const begin = () => { if (!started.current) started.current = performance.now() || 1; };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (name.trim().length < 2) return setErr("What should we call you?");
    if (!EMAIL_RE.test(email.trim())) return setErr("That email doesn't look right.");
    setBusy(true);
    let res: JoinResult;
    try {
      const r = await fetch("/api/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, website: honey.current?.value, elapsedMs: started.current ? performance.now() - started.current : undefined }) });
      res = await r.json();
    } catch { res = { ok: false, error: "Network error. Please try again.", fallback: false }; }
    setBusy(false);
    if (res.ok) { const j = { name: name.trim(), email: email.trim().toLowerCase(), token: res.token }; setJoined(j); onJoined?.(j); return; }
    if (!res.fallback) return setErr(res.error);
    // no database connected yet: the club's WhatsApp link (or email) instead, and say so honestly
    if (CLUB.joinUrl) { window.open(CLUB.joinUrl, "_blank", "noopener"); setErr("Almost there: join the WhatsApp community in the tab that just opened."); }
    else if (CLUB.email) window.location.assign(`mailto:${CLUB.email}?subject=${encodeURIComponent("Join the club")}&body=${encodeURIComponent(`Hi! I'd like to join.\n\nName: ${name}\nEmail: ${email}`)}`);
    else setErr("Sign-ups aren't open yet. Follow the events below.");
  };

  const hero = tone === "hero";
  const field = hero
    ? "h-[54px] min-w-0 flex-1 basis-[180px] rounded-md border-2 border-ink/15 bg-white px-4 text-[16px] outline-none transition-colors placeholder:text-ink-3 focus:border-ink"
    : "h-[54px] w-full min-w-0 rounded-md border-2 border-ink/15 bg-white px-4 text-[16px] outline-none transition-colors placeholder:text-ink-3 focus:border-ink";
  return (
    <form onSubmit={submit} onFocus={begin} noValidate className="relative">
      <div className={hero ? "flex flex-wrap gap-2.5" : "grid gap-2.5"}>
        <label className="contents"><span className="sr-only">Your name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={80} className={field} /></label>
        <label className="contents"><span className="sr-only">Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@gitam.in" autoComplete="email" className={field} /></label>
        <button disabled={busy} className={`lift h-[54px] flex-none rounded-md border-2 border-ink bg-ink px-6 font-display text-[16px] font-bold text-white disabled:opacity-70 ${hero ? "" : "w-full bg-[#1a7f37]"}`}>{busy ? "Joining…" : hero ? "Join the club" : "Merge pull request"}</button>
      </div>
      <input ref={honey} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <p role="status" aria-live="polite" className={`mt-2.5 min-h-[1.4em] text-[13.5px] ${err ? "text-[#a40e26]" : "text-ink-3"}`}>{err || "Free, no experience needed. We'll email you what's next and the WhatsApp link."}</p>
    </form>
  );
}

/** Step 2, optional: GitHub username (with a live look-up) and what they'd like to try first. */
export function JoinExtras({ joined, compact = false }: { joined: Joined; compact?: boolean }) {
  const [, setJoined] = useJoined();
  const [handle, setHandle] = useState(""), [found, setFound] = useState<{ name: string; avatar: string } | null>(null), [look, setLook] = useState("");
  const [event, setEvent] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const today = todayInIndia(), upcoming = EVENTS.filter((e) => e.date >= today).slice(0, 4);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onHandle = (raw: string) => {
    setHandle(raw); setFound(null); clearTimeout(timer.current);
    const v = cleanHandle(raw);
    if (!v) return setLook("");
    if (!HANDLE_RE.test(v)) return setLook("That doesn't look like a GitHub username.");
    setLook("Looking you up on GitHub…");
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://api.github.com/users/${encodeURIComponent(v)}`);
        if (r.status === 404) return setLook("No GitHub user with that name. Check the spelling?");
        if (!r.ok) throw new Error();
        const u = await r.json(); setFound({ name: u.name || u.login, avatar: `${u.avatar_url}&s=64` }); setLook("");
      } catch { setLook(""); }
    }, 450);
  };
  const save = async () => {
    setErr(""); if (!joined.token) return setErr("Join again with the same email to add these.");
    setBusy(true);
    try {
      const r = await fetch("/api/join/more", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: joined.email, token: joined.token, handle: cleanHandle(handle), firstEvent: event }) });
      const j = await r.json();
      if (j.ok) setJoined({ ...joined, extras: "done" }); else setErr(j.error ?? "Couldn't save that.");
    } catch { setErr("Network error. Please try again."); }
    setBusy(false);
  };
  return (
    <div className={compact ? "" : "rounded-xl border border-line bg-white p-5"}>
      <p className="text-[15px] font-semibold">Two optional extras, so we can cheer your first pull request</p>
      <label className="mt-3 flex items-center gap-2 rounded-md border-2 border-ink/15 bg-white px-3 focus-within:border-ink">
        <span className="text-ink-3">@</span><span className="sr-only">Your GitHub username</span>
        <input value={handle} onChange={(e) => onHandle(e.target.value)} placeholder="your-github-username" autoComplete="off" spellCheck={false} className="h-[48px] min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {found && <img src={found.avatar} alt="" className="h-8 w-8 rounded-full border-2 border-ink" />}
      </label>
      <p className="mt-1.5 min-h-[1.3em] text-[13px] text-ink-3">{found ? <span className="font-semibold text-[#116329]">Found you, {found.name}.</span> : look || <>No GitHub account yet? <a href="https://github.com/signup" target="_blank" rel="noopener" className="font-semibold text-link underline-offset-2 hover:underline">Make one in a minute ↗</a></>}</p>
      {upcoming.length > 0 && (
        <fieldset className="mt-2">
          <legend className="mb-2 text-[14px] font-semibold">What would you like to try first?</legend>
          <div className="flex flex-wrap gap-2">
            {upcoming.map((e) => (
              <label key={e.date} className={`cursor-pointer rounded-full border-2 px-3.5 py-1.5 text-[14px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-link ${event === e.date ? "border-ink bg-ink font-semibold text-white" : "border-line bg-white hover:border-ink/40"}`}>
                <input type="radio" name="first-event" value={e.date} checked={event === e.date} onChange={() => setEvent(e.date)} className="sr-only" />{e.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {err && <p role="alert" className="mt-3 text-[13.5px] text-[#a40e26]">{err}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button disabled={busy || (!found && !HANDLE_RE.test(cleanHandle(handle)) && !event)} onClick={save} className="press rounded-md bg-ink px-5 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        <button onClick={() => setJoined({ ...joined, extras: "later" })} className="text-[14px] text-ink-2 underline-offset-4 hover:underline">Later</button>
      </div>
    </div>
  );
}

/** "You're in": the welcome, the one next thing to do (WhatsApp), and the extras until they're done or put off. */
export function JoinedPanel({ joined, compact = false }: { joined: Joined; compact?: boolean }) {
  const [, setJoined] = useJoined();
  return (
    <div role="status" className="space-y-4">
      <p className="flex items-center gap-3 text-[18px]">
        <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#2da44e] text-white"><CheckIcon size={18} /></span>
        <span><b>You&apos;re in, {firstName(joined.name)}.</b> <span className="text-ink-2">Check your inbox for a welcome.</span></span>
      </p>
      {CLUB.joinUrl && <a href={CLUB.joinUrl} target="_blank" rel="noopener" className="lift inline-flex items-center gap-2 rounded-md border-2 border-ink bg-[#25d366] px-5 py-3 font-display font-bold text-ink">Join the WhatsApp community →</a>}
      {!joined.extras && <JoinExtras joined={joined} compact={compact} />}
      {joined.extras === "later" && <button onClick={() => setJoined({ ...joined, extras: undefined })} className="block text-[14px] font-semibold text-link underline-offset-4 hover:underline">Add your GitHub username</button>}
    </div>
  );
}

/** The hero's version: the form, or "you're in" for someone who already joined on this browser. */
export function HeroJoin() {
  const [joined] = useJoined();
  return joined ? <JoinedPanel joined={joined} compact /> : <JoinForm tone="hero" />;
}
