"use client";
import { useCallback, useEffect, useState } from "react";
import { pendingRoles, people, setRole, type Person } from "@/lib/admin/client";

/* Who can use the dashboard. Volunteers see everything and mark attendance; admins also send emails and
   change roles. The database enforces this (set_role), including "you can't change your own role". */
const card = "rounded-[12px] border border-line bg-white";
const btn = "inline-flex items-center justify-center rounded-md bg-ink px-4 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50";
const ROLE_LABEL: Record<Person["role"], string> = { attendee: "No access", volunteer: "Volunteer", admin: "Admin" };

export function People({ admin, me }: { admin: boolean; me: string }) {
  const [list, setList] = useState<Person[] | null>(null);
  const [handle, setHandle] = useState(""); const [role, setR] = useState<Person["role"]>("volunteer");
  const [note, setNote] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState<{ handle: string; role: Person["role"] }[]>([]);
  const load = useCallback(async () => { setList(await people()); if (admin) setWaiting(await pendingRoles()); }, [admin]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);

  const change = async (h: string, r: Person["role"]) => {
    setBusy(true); setNote(null);
    const res = await setRole(h, r); setBusy(false);
    const who = `@${h.replace(/^@/, "")}`;
    setNote(res.ok ? { k: "ok", t: res.pending ? `${who} will be ${ROLE_LABEL[r]} as soon as they sign in at /admin.` : `${who} is now: ${ROLE_LABEL[r]}.` } : { k: "err", t: res.error });
    if (res.ok) { setHandle(""); await load(); }
  };

  const team = (list ?? []).filter((p) => p.role !== "attendee");
  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}
      {admin && (
        <section className={`${card} p-5`} aria-labelledby="give-h">
          <h2 id="give-h" className="text-[18px]">Give someone access</h2>
          <p className="mt-1 text-[14.5px] text-ink-2">Type their GitHub username. If they haven&apos;t signed in yet, access applies the first time they sign in at <code>/admin</code>.</p>
          <form onSubmit={(e) => { e.preventDefault(); void change(handle.trim(), role); }} className="mt-4 flex flex-wrap gap-2">
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="github-username" aria-label="GitHub username" className="min-w-[220px] flex-1 rounded-md border border-line px-3 py-2.5 text-[15px]" />
            <select value={role} onChange={(e) => setR(e.target.value as Person["role"])} aria-label="Role" className="rounded-md border border-line bg-white px-3 py-2.5 text-[15px]">
              <option value="volunteer">Volunteer</option><option value="admin">Admin</option>
            </select>
            <button disabled={busy || handle.trim().length < 1} className={btn}>Give access</button>
          </form>
        </section>
      )}

      <section className={card} aria-labelledby="team-h">
        <h2 id="team-h" className="border-b border-line px-5 py-3 text-[18px]">Organisers <span className="ml-1 rounded-full bg-soft px-2 py-0.5 text-[12px] font-normal text-ink-3">{team.length}</span></h2>
        {list === null ? <p className="p-5 text-ink-3">Loading…</p> : (
          <ul className="divide-y divide-line">
            {team.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[14.5px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://github.com/${p.handle}.png?size=64`} alt="" width={32} height={32} className="rounded-full bg-soft" />
                <span><b>{p.name}</b> <a href={`https://github.com/${p.handle}`} target="_blank" rel="noopener" className="text-ink-3 hover:underline">@{p.handle}</a></span>
                <span className="ml-auto flex items-center gap-3">
                  {admin && p.handle !== me ? (
                    <select value={p.role} disabled={busy} onChange={(e) => void change(p.handle, e.target.value as Person["role"])} aria-label={`Role for @${p.handle}`} className="rounded-md border border-line bg-white px-2 py-1.5 text-[14px]">
                      <option value="volunteer">Volunteer</option><option value="admin">Admin</option><option value="attendee">Remove access</option>
                    </select>
                  ) : <span className="rounded-full border border-line px-2.5 py-0.5 text-[13px]">{ROLE_LABEL[p.role]}{p.handle === me ? " · you" : ""}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {admin && waiting.length > 0 && (
        <section className={card} aria-labelledby="wait-h">
          <h2 id="wait-h" className="border-b border-line px-5 py-3 text-[18px]">Waiting for first sign-in <span className="ml-1 rounded-full bg-soft px-2 py-0.5 text-[12px] font-normal text-ink-3">{waiting.length}</span></h2>
          <ul className="divide-y divide-line">
            {waiting.map((w) => (
              <li key={w.handle} className="flex items-center gap-3 px-5 py-3 text-[14.5px]">
                <a href={`https://github.com/${w.handle}`} target="_blank" rel="noopener" className="font-semibold hover:underline">@{w.handle}</a>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-[13px]">{ROLE_LABEL[w.role]}</span>
                <button disabled={busy} onClick={() => void change(w.handle, "attendee")} className="ml-auto text-ink-2 underline-offset-4 hover:underline">Cancel</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {list && <p className="text-[13.5px] text-ink-3">{list.length - team.length} other {list.length - team.length === 1 ? "person has" : "people have"} signed in (Epoch attendees and anyone who opened /admin).</p>}
    </div>
  );
}
