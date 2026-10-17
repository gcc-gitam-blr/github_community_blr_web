"use client";
import { useCallback, useEffect, useState } from "react";
import { cancelPending, endAppointment, grantAppointment, pendingRoles, people, type Pending, type Person } from "@/lib/admin/client";
import { addDays, endsLabel, endsSoon, MAX_DAYS, niceDate, ROLE_HELP, ROLE_LABEL, todayIST, type AccessRole } from "@/lib/admin/appointments";
import { Composer, Role, btn, card, count, head, input } from "./kit";

/* Who has access, and until when. Every role is an appointment with an end date: when it passes, access stops by
   itself. Organisers see who has what; admins also appoint, extend, change and end. The database enforces all of it
   (grant_appointment, end_appointment), including "you can't change your own access". */
const link = "text-ink-2 underline-offset-4 hover:underline disabled:opacity-50";
const ROLES: AccessRole[] = ["volunteer", "core", "admin"];

export function People({ admin, me }: { admin: boolean; me: string }) {
  const [list, setList] = useState<Person[] | null>(null);
  const [waiting, setWaiting] = useState<Pending[]>([]);
  const [handle, setHandle] = useState(""); const [role, setRole] = useState<AccessRole>("volunteer");
  const [title, setTitle] = useState(""); const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState<number | null>(null); // the appointment waiting for "Yes, end it"
  const load = useCallback(async () => { setList(await people()); if (admin) setWaiting(await pendingRoles()); }, [admin]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);

  const today = todayIST(), latest = addDays(today, MAX_DAYS);
  const done = (ok: boolean, text: string) => setNote({ k: ok ? "ok" : "err", t: text });

  const give = async () => {
    setBusy(true); setNote(null);
    const h = handle.trim().replace(/^@/, ""), res = await grantAppointment(h, role, title, endsOn); setBusy(false);
    if (!res.ok) return done(false, res.error);
    done(true, res.pending ? `@${h} will be ${ROLE_LABEL[role]} from their first sign-in at /admin until ${niceDate(endsOn)}.` : `@${h} is now ${ROLE_LABEL[role]} until ${niceDate(endsOn)}.`);
    setHandle(""); setTitle(""); await load();
  };
  const end = async (p: Person) => {
    if (p.appointment_id === null) return;
    setBusy(true); setNote(null);
    const res = await endAppointment(p.appointment_id, "ended from People & roles"); setBusy(false); setEnding(null);
    done(res.ok, res.ok ? `@${p.handle} no longer has access.` : res.error);
    if (res.ok) await load();
  };
  const cancel = async (w: Pending) => {
    setBusy(true); setNote(null);
    const res = await cancelPending(w.handle); setBusy(false);
    done(res.ok, res.ok ? `Cancelled the invitation for @${w.handle}.` : res.error);
    if (res.ok) await load();
  };
  // fill the form with someone's current appointment, to change the role or extend the term
  const change = (p: Person) => { setHandle(p.handle); setRole(p.role === "attendee" ? "volunteer" : p.role); setTitle(p.title ?? ""); setEndsOn(""); requestAnimationFrame(() => { document.getElementById("give-h")?.scrollIntoView({ block: "center" }); document.getElementById("who")?.focus(); }); };

  const team = (list ?? []).filter((p) => p.role !== "attendee").sort((a, b) => (a.ends_on ?? "9").localeCompare(b.ends_on ?? "9"));
  const admins = team.filter((p) => p.role === "admin").length;
  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}
      {admin && list && admins < 2 && (
        <p role="status" className="rounded-md bg-[#fff8c5] px-4 py-3 text-[14.5px] text-[#4d2d00]">
          {admins === 0 ? "No admin is active." : "Only one admin is active."} Appoint a second one so the club can always manage access.
        </p>
      )}
      {admin && (
        <Composer id="give-h" title="Give someone access" forceOpen={handle.trim() !== ""}>
          <p className="mt-1 text-[14.5px] text-ink-2">Pick a role and the day it ends. Access stops by itself on that day. Giving someone a new role or date replaces their current one. If they haven&apos;t signed in yet, it starts the first time they sign in at <code>/admin</code>.</p>
          <form onSubmit={(e) => { e.preventDefault(); void give(); }} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-[14px] font-semibold">GitHub username
              <input id="who" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="github-username" autoComplete="off" className={`${input} mt-1 w-full font-normal`} />
            </label>
            <label className="block text-[14px] font-semibold">Role
              <select value={role} onChange={(e) => setRole(e.target.value as AccessRole)} className={`${input} mt-1 w-full font-normal`}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
            <label className="block text-[14px] font-semibold">Title <span className="font-normal text-ink-3">(optional, e.g. President)</span>
              <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className={`${input} mt-1 w-full font-normal`} />
            </label>
            <label className="block text-[14px] font-semibold">Access ends on
              <input type="date" required value={endsOn} min={today} max={latest} onChange={(e) => setEndsOn(e.target.value)} className={`${input} mt-1 w-full font-normal`} />
            </label>
            <p className="text-[13.5px] text-ink-3 sm:col-span-2">{ROLE_HELP[role]}</p>
            <div className="sm:col-span-2"><button disabled={busy || !handle.trim() || !endsOn} className={btn}>Give access</button></div>
          </form>
        </Composer>
      )}

      <section className={card} aria-labelledby="team-h">
        <div className={head}><h2 id="team-h" className="text-[18px]">Organisers</h2><span className={count}>{team.length}</span></div>
        {list === null ? <p className="p-5 text-ink-3">Loading…</p> : (["admin", "core", "volunteer"] as const).map((r) => {
          const group = team.filter((p) => p.role === r);
          if (!group.length) return null;
          return (
          <div key={r}>
          <h3 className="border-b border-line bg-soft px-5 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.08em] text-ink-3">{({ admin: "Admins", core: "Core team", volunteer: "Volunteers" } as const)[r]} · {group.length}</h3>
          <ul className="divide-y divide-line border-b border-line last:border-b-0">
            {group.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[14.5px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://github.com/${p.handle}.png?size=64`} alt="" width={32} height={32} className="rounded-full bg-soft" />
                <span><b>{p.name}</b> <a href={`https://github.com/${p.handle}`} target="_blank" rel="noopener" className="text-ink-3 hover:underline">@{p.handle}</a></span>
                <Role role={p.role}>{ROLE_LABEL[p.role]}</Role>{p.title && <span className="text-ink-2">{p.title}</span>}{p.handle === me && <span className="font-mono text-[12px] font-semibold text-[#116329]">you</span>}
                {p.ends_on && (
                  <span className={`text-[13.5px] ${endsSoon(p.ends_on) ? "font-semibold text-[#9a6700]" : "text-ink-3"}`} title={niceDate(p.ends_on)}>{endsLabel(p.ends_on)} · {niceDate(p.ends_on)}</span>
                )}
                {admin && p.handle !== me && p.appointment_id !== null && (
                  <span className="ml-auto flex items-center gap-4">
                    <button disabled={busy} onClick={() => change(p)} className={link} aria-label={`Change role or extend for @${p.handle}`}>Change or extend</button>
                    {ending === p.appointment_id ? (<>
                      <button disabled={busy} onClick={() => void end(p)} className="font-semibold text-[#a40e26] underline-offset-4 hover:underline disabled:opacity-50">Yes, end it now</button>
                      <button disabled={busy} onClick={() => setEnding(null)} className={link}>Keep</button>
                    </>) : <button disabled={busy} onClick={() => setEnding(p.appointment_id)} className={link} aria-label={`End access for @${p.handle}`}>End access</button>}
                  </span>
                )}
              </li>
            ))}
          </ul>
          </div>
          );
        })}
      </section>
      {admin && waiting.length > 0 && (
        <section className={card} aria-labelledby="wait-h">
          <div className={head}><h2 id="wait-h" className="text-[18px]">Waiting for first sign-in</h2><span className={count}>{waiting.length}</span></div>
          <ul className="divide-y divide-line">
            {waiting.map((w) => (
              <li key={w.handle} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[14.5px]">
                <a href={`https://github.com/${w.handle}`} target="_blank" rel="noopener" className="font-semibold hover:underline">@{w.handle}</a>
                <Role role={w.role}>{ROLE_LABEL[w.role]}</Role>{w.title && <span className="text-ink-2">{w.title}</span>}
                <span className={`text-[13.5px] ${w.ends_on ? "text-ink-3" : "font-semibold text-[#9a6700]"}`}>{w.ends_on ? `until ${niceDate(w.ends_on)}` : "no end date: give access again with one"}</span>
                <button disabled={busy} onClick={() => void cancel(w)} className={`ml-auto ${link}`}>Cancel</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {list && <p className="text-[13.5px] text-ink-3">{list.length - team.length} other {list.length - team.length === 1 ? "person has" : "people have"} signed in (Epoch attendees and anyone who opened /admin).</p>}
    </div>
  );
}
