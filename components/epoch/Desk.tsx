"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Notice } from "./Frame";
import { btnSoft, field, glass, label } from "./Bits";
import { AttendeeSearch, COIN_BOOTHS, boothName } from "./Staff";
import { useEpoch } from "./EpochProvider";
import type { AuditAction, AuditEntry, Profile, Role } from "@/lib/epoch/types";

/* The organiser desk's own tools: find an attendee, who runs which booth, and the audit log. */

const h2 = "text-[28px] font-medium tracking-[-0.03em]";
const chip = (on: boolean) => `rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? "border-ink bg-ink text-white" : "border-hair hover:border-ink/40"}`;

/** Someone without their QR: find them and open them on the scan page. */
export function FindAttendee() {
  const router = useRouter();
  return (
    <section className={`${glass} no-print mb-4 p-6 sm:p-8`}>
      <h2 className={`${h2} mb-4`}>Find an attendee</h2>
      <AttendeeSearch id="desk-find" onPick={(p) => router.push(`/epoch/scan?u=${encodeURIComponent(p.id)}`)} />
    </section>
  );
}

/** Who's on which booth. Admins give or take organiser access and move volunteers between booths. */
export function Team() {
  const { store, me } = useEpoch();
  const admin = me?.role === "admin";
  const [rows, setRows] = useState<Profile[] | null>(null); const [all, setAll] = useState(false);
  const [handle, setHandle] = useState(""); const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setRows((await store?.staff()) ?? []), [store]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);

  const act = async (p: Promise<{ ok: boolean; error?: string }> | undefined, done: string) => {
    if (!p) return; setBusy(true); setMsg(null);
    const r = await p; setBusy(false);
    setMsg(r.ok ? { k: "ok", t: done } : { k: "err", t: r.error ?? "That didn't work." });
    if (r.ok) await load();
  };
  const role = (p: Profile, r: Role) => act(store?.setRole(p.handle, r), r === "attendee" ? `@${p.handle} is an attendee again.` : `@${p.handle} is now ${r === "admin" ? "an admin" : "a volunteer"}.`);
  const booth = (p: Profile, b: string) => act(store?.assignBooth(p.handle, b || null), b ? `@${p.handle} now runs ${boothName(b)}.` : `@${p.handle} is on the desk.`);
  const add = async () => { const h = handle.trim().replace(/^@/, ""); if (!h) return; await act(store?.setRole(h, "volunteer"), `@${h} is now a volunteer. Pick their booth below.`); setHandle(""); };

  const list = [...(rows ?? [])].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1));
  const shown = all ? list : list.slice(0, 6);
  const onBooth = list.filter((p) => p.role === "volunteer" && p.booth).length, onDesk = list.filter((p) => p.role === "volunteer" && !p.booth).length;

  return (
    <section className={`${glass} no-print mb-4 p-6 sm:p-8`} aria-labelledby="team-h">
      <div className="mb-4">
        <h2 id="team-h" className={h2}>Who runs what</h2>
        <p className={label}>{rows === null ? "Loading…" : `${list.filter((p) => p.role === "admin").length} admin${list.filter((p) => p.role === "admin").length === 1 ? "" : "s"} · ${onBooth} on a booth · ${onDesk} on the desk. A volunteer with a booth scans wallets there; on the desk, they check people in.`}</p>
      </div>
      {msg && <div className="mb-4"><Notice kind={msg.k}>{msg.t}</Notice></div>}
      {list.length > 0 && (
        <ul className="divide-y divide-hair border-y border-hair">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <span className="min-w-0 flex-1 basis-[160px]"><span className="block truncate text-[16px] font-medium">{p.name}</span><span className="block truncate font-mono text-[12px] text-mute">@{p.handle}</span></span>
              {admin && p.id !== me?.id ? (<>
                <select aria-label={`Role for @${p.handle}`} disabled={busy} value={p.role} onChange={(e) => role(p, e.target.value as Role)} className={`${field} !w-auto !rounded-full !py-2 !pl-4 !pr-8 !text-[14px]`}>
                  <option value="volunteer">Volunteer</option><option value="admin">Admin</option><option value="attendee">Remove access</option>
                </select>
                {p.role === "volunteer" && (
                  <select aria-label={`Booth for @${p.handle}`} disabled={busy} value={p.booth ?? ""} onChange={(e) => booth(p, e.target.value)} className={`${field} !w-auto !max-w-full !rounded-full !py-2 !pl-4 !pr-8 !text-[14px]`}>
                    <option value="">Desk (check-in)</option>{COIN_BOOTHS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
              </>) : <span className="font-mono text-[12px] text-mute">{p.role}{p.role === "volunteer" ? ` · ${p.booth ? boothName(p.booth) : "desk"}` : ""}{p.id === me?.id ? " · you" : ""}</span>}
            </li>
          ))}
        </ul>
      )}
      {list.length > 6 && <button onClick={() => setAll(!all)} className="mt-2 text-[13px] text-mute underline underline-offset-2">{all ? "Show fewer" : `Show all ${list.length}`}</button>}
      {admin && (
        <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="mt-5 flex flex-wrap gap-2">
          <label htmlFor="add-vol" className="sr-only">GitHub username of the new volunteer</label>
          <input id="add-vol" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@github-username" autoComplete="off" className={`${field} !w-auto min-w-0 flex-1 !py-3 !text-[16px]`} />
          <button disabled={busy || !handle.trim()} className={`${btnSoft} !py-3`}>Add a volunteer</button>
        </form>
      )}
    </section>
  );
}

const ACTIONS: { id: AuditAction | ""; l: string }[] = [{ id: "", l: "All" }, { id: "ticket", l: "Check-ins" }, { id: "scan", l: "Scans" }, { id: "award", l: "Awards" }, { id: "reverse", l: "Reversals" }, { id: "role", l: "Roles" }, { id: "booth", l: "Booths" }];
const VERB: Record<AuditAction, string> = { ticket: "checked in", award: "awarded", scan: "scanned", reverse: "reversed", role: "changed the role of", booth: "moved" };
const coins = (n: number | null) => (n == null ? "" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`);
const time = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Who did what, newest first, like a `git log` of the day. Admins only. */
export function AuditLog() {
  const { store, me } = useEpoch();
  const [action, setAction] = useState<AuditAction | "">(""); const [who, setWho] = useState("");
  const [rows, setRows] = useState<AuditEntry[] | null>(null); const [n, setN] = useState(12);
  useEffect(() => {
    if (me?.role !== "admin") return;
    const t = setTimeout(async () => setRows((await store?.audit({ action: action || undefined, who })) ?? []), 250);
    return () => clearTimeout(t);
  }, [store, me?.role, action, who]);
  if (me?.role !== "admin") return null;
  const shown = (rows ?? []).slice(0, n);

  return (
    <section className={`${glass} no-print mb-4 p-6 sm:p-8`} aria-labelledby="audit-h">
      <div className="mb-4">
        <h2 id="audit-h" className={h2}>Audit log</h2>
        <p className={label}>Every check-in, award, scan for someone, reversal and role or booth change, as it happened. Nobody can edit it.</p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ACTIONS.map((a) => <button key={a.id} onClick={() => { setAction(a.id); setN(12); }} aria-pressed={action === a.id} className={chip(action === a.id)}>{a.l}</button>)}
        <label htmlFor="audit-who" className="sr-only">Filter by GitHub username</label>
        <input id="audit-who" type="search" value={who} onChange={(e) => { setWho(e.target.value); setN(12); }} placeholder="@someone" autoComplete="off" className={`${field} !w-auto min-w-0 flex-1 basis-[160px] !rounded-full !py-2 !text-[14px]`} />
      </div>
      {rows === null ? <p className="text-mute">Loading…</p> : rows.length === 0 ? <p className="text-mute">{action || who ? "Nothing matches." : "Nothing yet. Staff actions show here as they happen."}</p> : (
        <ol className="relative ml-[5px] border-l-2 border-hair">
          {shown.map((e) => (
            <li key={e.id} className="relative py-2.5 pl-5">
              <span aria-hidden className={`absolute -left-[7px] top-[17px] h-3 w-3 rounded-full border-2 border-white ${e.action === "reverse" ? "bg-[#cf222e]" : e.action === "role" || e.action === "booth" ? "bg-[#8250df]" : "bg-[#2da44e]"}`} />
              <p className="text-[15px] leading-snug">
                <span className="font-mono text-[13px] font-bold">@{e.actor}</span> {VERB[e.action]}{e.target && <> <span className="font-mono text-[13px] font-bold">@{e.target}</span></>}
                {e.amount != null && <span className={`ml-1.5 font-mono text-[13px] ${e.amount < 0 ? "text-[#cf222e]" : "text-[#1a7f37]"}`}>{coins(e.amount)}</span>}
                {e.action === "booth" ? <> to {e.booth ? boothName(e.booth) : "the desk"}</> : e.booth ? <> at {boothName(e.booth)}</> : null}
                {e.action === "role" && <> to {e.detail}</>}
              </p>
              <p className="font-mono text-[12px] text-mute">{time(e.at)}{e.detail && e.action !== "role" && e.action !== "booth" ? ` · ${e.detail}` : ""}</p>
            </li>
          ))}
        </ol>
      )}
      {rows && rows.length > n && <button onClick={() => setN(n + 25)} className={`${btnSoft} mt-4 !px-5 !py-2.5`}>Show {Math.min(25, rows.length - n)} more</button>}
    </section>
  );
}
