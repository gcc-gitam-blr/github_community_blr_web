"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Notice } from "./Frame";
import { btnInk, btnSoft, field, label } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { BOOTHS, EPOCH, STARTER_COINS } from "@/lib/epoch/config";
import { REVERSE_WINDOW_MIN, reverseBlock, scanBlock } from "@/lib/epoch/rules";
import { place, shortRef } from "@/lib/epoch/receipt";
import type { Profile, Tx } from "@/lib/epoch/types";

/* Staff tools on the scan page and the desk: find an attendee, then check them in, scan for a booth,
   award (admins) or reverse a mistake. The store (and on the live site, the database) decides what's allowed;
   this only offers what will work for the signed-in organiser. */

export const COIN_BOOTHS = BOOTHS.filter((b) => b.kind !== "free");
export const boothName = (id?: string | null) => COIN_BOOTHS.find((b) => b.id === id)?.name ?? id ?? "";
export type Outcome = { ok: true; title: string; delta: number; balance: number } | { ok: false; error: string };

const ago = (iso: string) => { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }); };
const signed = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;

/** One line about what this organiser does today. */
export function postLine(me: Profile) {
  if (me.role === "admin") return "Admin: check people in, scan for any booth, award coins and reverse mistakes.";
  if (me.booth) return `You run ${boothName(me.booth)}. Scan a wallet to ${COIN_BOOTHS.find((b) => b.id === me.booth)?.kind === "recharge" ? "pay someone who passed" : "charge a session"}, or undo a scan from the last ${REVERSE_WINDOW_MIN} minutes.`;
  return "You're on the desk: scan a wallet to check someone in. An admin can give you a booth.";
}

/** Find an attendee by name, GitHub username or email (a dead phone, a lost QR). */
export function AttendeeSearch({ onPick, id = "find" }: { onPick: (p: Profile) => void; id?: string }) {
  const { store } = useEpoch();
  const [q, setQ] = useState(""); const [rows, setRows] = useState<Profile[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined); const seq = useRef(0);
  const change = (v: string) => {
    setQ(v); clearTimeout(timer.current);
    if (v.trim().replace(/^@/, "").length < 2) return setRows(null);
    const n = ++seq.current;
    timer.current = setTimeout(async () => { const r = (await store?.search(v)) ?? []; if (n === seq.current) setRows(r); }, 250);
  };
  const shown = rows?.slice(0, 5) ?? [];
  return (
    <div>
      <label htmlFor={id} className={`${label} mb-2 block`}>Can&apos;t scan? Find them by name, GitHub username or email</label>
      <input id={id} type="search" value={q} onChange={(e) => change(e.target.value)} placeholder="e.g. Ada, @ada or ada@gitam.in" autoComplete="off" className={`${field} !py-3 !text-[16px]`} />
      {rows && (
        <div aria-live="polite">
          {rows.length === 0 ? <p className="mt-3 text-[15px] text-mute">Nobody found. Check the spelling, or ask them to open their wallet.</p> : (
            <ul className="mt-3 divide-y divide-hair overflow-hidden rounded-2xl border border-hair bg-white">
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { onPick(p); setQ(""); setRows(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink/[.03] focus-visible:bg-ink/[.04]">
                    <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-medium">{p.name}</span><span className="block truncate text-[13px] text-mute">@{p.handle}{p.email ? ` · ${p.email}` : ""}</span></span>
                    <span className="shrink-0 text-right font-mono text-[13px]">{p.coins} {EPOCH.currency}<span className={`block text-[12px] ${p.ticket ? "text-[#1a7f37]" : "text-mute"}`}>{p.ticket ? "checked in" : "not checked in"}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rows.length > shown.length && <p className="mt-2 text-[13px] text-mute">{rows.length - shown.length} more — type a little more to narrow it down.</p>}
        </div>
      )}
    </div>
  );
}

/** The attendee being served: check-in, a booth scan, an award, and their recent lines with a Reverse button. */
export function StaffPanel({ target, onClose, onResult }: { target: Profile; onClose: () => void; onResult: (o: Outcome) => void }) {
  const { store, me } = useEpoch();
  const admin = me?.role === "admin";
  const [booth, setBooth] = useState(me?.booth ?? "vr");
  const [hist, setHist] = useState<Tx[] | null>(null); const [all, setAll] = useState(false);
  const [undo, setUndo] = useState<Tx | null>(null); const [why, setWhy] = useState("");
  const [amount, setAmount] = useState(25); const [reason, setReason] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setHist((await store?.staffHistory(target.id)) ?? []), [store, target.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);

  const b = COIN_BOOTHS.find((x) => x.id === booth);
  const run = async <T extends { ok: boolean },>(p: Promise<T> | undefined, ok: (r: T) => Outcome) => {
    if (!p) return; setBusy(true); setErr("");
    const r = await p; setBusy(false);
    if (r.ok) onResult(ok(r)); else setErr((r as unknown as { error: string }).error);
  };
  const verify = () => run(store?.issueTicket(target.id), (r) => ({ ok: true, title: `Ticket verified · @${target.handle}`, delta: STARTER_COINS, balance: (r as { profile: Profile }).profile.coins }));
  const scan = () => run(store?.staffScan(target.id, booth), (r) => { const x = r as unknown as { delta: number; balance: number }; return { ok: true, title: `${b?.name} · @${target.handle}`, delta: x.delta, balance: x.balance }; });
  const award = () => run(store?.award(target.id, amount, reason), (r) => ({ ok: true, title: `${reason || "Organiser award"} · @${target.handle}`, delta: amount, balance: (r as { profile: Profile }).profile.coins }));
  const reverse = (t: Tx) => run(store?.reverse(t.id, why), (r) => { const x = r as unknown as { delta: number; balance: number }; return { ok: true, title: `Reversed: ${t.reason} · @${target.handle}`, delta: x.delta, balance: x.balance }; });

  const lines = (hist ?? []).filter((t) => !t.ref.startsWith("reverse:"));
  const shown = all ? lines : lines.slice(0, 4);
  const bookable = !!me && !scanBlock(me, booth);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[32px] font-medium leading-tight tracking-[-0.03em]">{target.name}</p>
        <p className={label}>@{target.handle} · {target.coins} coins · ticket {target.ticket ? "verified" : "pending"}</p>
      </div>
      {err && <Notice kind="err">{err}</Notice>}
      {!target.ticket && <button disabled={busy} onClick={verify} className={`${btnInk} w-full`}>Verify ticket · +{STARTER_COINS} {EPOCH.currency}</button>}

      {/* a booth scan: the volunteer's own booth, or any booth for an admin */}
      {(admin || me?.booth) && target.ticket && (
        <div className="space-y-3 border-t border-hair pt-5">
          {admin
            ? <label className="block"><span className={`${label} mb-2 block`}>Scan for a booth</span>
                <select value={booth} onChange={(e) => setBooth(e.target.value)} className={`${field} !py-3 !text-[16px]`}>{COIN_BOOTHS.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.kind === "recharge" ? `+${x.coins} once` : `−${x.coins}`}</option>)}</select></label>
            : <p className={label}>Your booth</p>}
          {b && bookable && <button disabled={busy} onClick={scan} className={`${admin ? btnSoft : btnInk} w-full`}>{b.kind === "recharge" ? `They passed · pay +${b.coins}` : `Charge ${b.coins} · ${b.name}`}</button>}
        </div>
      )}

      {admin && (
        <div className="space-y-3 border-t border-hair pt-5">
          <p className={label}>Award or deduct (admins)</p>
          <div className="flex gap-2">{[10, 20, 50, 100].map((n) => <button key={n} onClick={() => setAmount(n)} aria-pressed={amount === n} className={`flex-1 rounded-full border py-2 text-sm ${amount === n ? "border-ink bg-ink text-white" : "border-hair"}`}>+{n}</button>)}</div>
          <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className={`${field} !py-3`} aria-label="Coins (negative to deduct)" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. Fail-Proof Code winner" aria-label="Reason" className={`${field} !py-3`} />
          <button disabled={busy || !amount} onClick={award} className={`${btnSoft} w-full`}>{amount >= 0 ? "Award" : "Deduct"} {Math.abs(amount)}</button>
        </div>
      )}

      {/* recent lines this organiser can act on: a volunteer sees their own booth's */}
      {lines.length > 0 && (
        <div className="border-t border-hair pt-5">
          <p className={`${label} mb-2`}>{admin ? "Their recent transactions" : "Recent scans at your booth"}</p>
          <ul className="divide-y divide-hair">
            {shown.map((t) => {
              const block = me ? reverseBlock(me, t) : "";
              return (
                <li key={t.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-14 shrink-0 font-mono text-[15px] font-bold tabular-nums ${t.reversedAt ? "text-mute line-through" : ""}`}>{signed(t.delta)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[15px]">{t.reason}</span><span className="block truncate font-mono text-[12px] text-mute">{shortRef(t.id)} · {place(t)} · {ago(t.at)}</span></span>
                    {t.reversedAt ? <span className="shrink-0 rounded-full bg-ink/[.06] px-2.5 py-1 text-[12px] text-mute">Reversed</span>
                      : !block ? <button onClick={() => { setUndo(undo?.id === t.id ? null : t); setWhy(""); setErr(""); }} aria-expanded={undo?.id === t.id} className="shrink-0 rounded-full border border-hair px-3.5 py-1.5 text-[13px] transition hover:border-ink/40">Reverse</button>
                      : <span className="shrink-0 text-[12px] text-mute">{/15 minutes/.test(block) ? "Ask an admin" : ""}</span>}
                  </div>
                  {undo?.id === t.id && (
                    <div className="mt-3 space-y-2 rounded-2xl bg-ink/[.04] p-3">
                      <p className="text-[14px]">{t.delta < 0 ? `Gives ${target.name.split(" ")[0]} ${-t.delta} coins back.` : `Takes ${t.delta} coins back from ${target.name.split(" ")[0]}.`} It shows in their wallet and the audit log.</p>
                      <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why? e.g. scanned twice" aria-label="Why it's being reversed" className={`${field} !py-2.5 !text-[15px]`} />
                      <div className="flex gap-2"><button disabled={busy} onClick={() => reverse(t)} className={`${btnInk} !px-5 !py-2.5`}>Reverse {signed(t.delta)}</button><button onClick={() => setUndo(null)} className={`${btnSoft} !px-5 !py-2.5`}>Keep it</button></div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {lines.length > 4 && <button onClick={() => setAll(!all)} className="mt-1 text-[13px] text-mute underline underline-offset-2">{all ? "Show fewer" : `Show all ${lines.length}`}</button>}
        </div>
      )}
      {me?.role === "volunteer" && !me.booth && target.ticket && <p className="text-[14px] text-mute">Checked in already. Booth scans and reversals are for the booth&apos;s volunteer or an admin.</p>}
      <button onClick={onClose} className="text-sm text-mute underline">Done</button>
    </div>
  );
}

/** The desk's first card: who you are today and where to go. */
export function MyPost() {
  const { me } = useEpoch();
  if (!me) return null;
  return (
    <section className="no-print mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-ink/10 bg-white p-6 sm:p-8">
      <div className="min-w-0">
        <p className="font-mono text-[12px] text-mute">{me.role}{me.booth ? ` · booth:${me.booth}` : me.role === "volunteer" ? " · desk" : ""}</p>
        <p className="mt-1 max-w-[56ch] text-[17px]">{postLine(me)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {me.booth && <Link href={`/epoch/kiosk/${me.booth}`} className={`${btnSoft} !py-3`}>Open my booth&apos;s kiosk</Link>}
        <Link href="/epoch/guide/organisers" className={`${btnSoft} !py-3`}>Organiser guide</Link>
      </div>
    </section>
  );
}
