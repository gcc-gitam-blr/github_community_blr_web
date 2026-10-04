"use client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Frame, Notice } from "./Frame";
import { Coin, btnInk, btnSoft, field, glass, label } from "./Bits";
import { BoothSection } from "./home/BoothSection";
import { AuditLog, FindAttendee, Team } from "./Desk";
import { MyPost } from "./Staff";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { useLiveLeaderboard, type BoardLink } from "@/lib/epoch/live";
import { BOOTHS, STARTER_COINS, EPOCH } from "@/lib/epoch/config";
import type { Audience, ClubMessage, EventFeedback, JoinRequest, Reward } from "@/lib/epoch/types";
import { KINDS } from "@/lib/contact";
import { CLUB } from "@/lib/config";
import { clubStats, type ClubStats } from "@/lib/stats";

export function BoothsPage() {
  return <Frame title="Where coins go." sub="Recharge points earn. Everything else spends."><BoothSection /></Frame>;
}

export function ShopPage() {
  const { store, me, refresh } = useEpoch(); const [items, setItems] = useState<Reward[]>([]);
  const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null); const [busy, setBusy] = useState("");
  const load = useCallback(() => store?.rewards().then(setItems), [store]);
  useEffect(() => { void load(); }, [load]);

  const buy = async (r: Reward) => {
    if (!store) return; setBusy(r.id); setMsg(null);
    const res = await store.redeem(r.id); setBusy("");
    if (res.ok) { setMsg({ k: "ok", t: `Bought ${r.name}. Show this screen at the Merchandise Stall.` }); await refresh(); void load(); } else setMsg({ k: "err", t: res.error });
  };

  return (
    <Frame title="Merch, in coins." aside={me ? <Link href="/epoch/wallet" className={`${btnSoft} !py-3`}><Coin size={18} />{me.coins}</Link> : <Link href="/epoch/register" className={btnInk}>Get ticket</Link>}>
      {msg && <div className="mb-6"><Notice kind={msg.k}>{msg.t}</Notice></div>}
      <ul className="border-t border-hair">
        {items.map((r) => {
          const afford = !!me && me.coins >= r.cost;
          return (
            <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 border-b border-hair py-6 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_80px_150px]">
              <div><h3 className="text-[24px] font-medium tracking-[-0.03em]">{r.name}</h3><p className={label}>{r.stock} left</p></div>
              <p className="order-3 col-span-2 text-[16px] text-mute sm:order-none sm:col-span-1">{r.blurb}</p>
              <span className="flex items-center gap-2 text-[19px]"><Coin size={18} />{r.cost}</span>
              <button disabled={!me || !afford || r.stock <= 0 || busy === r.id} onClick={() => buy(r)} className={afford ? btnInk : btnSoft}>
                {r.stock <= 0 ? "Sold out" : !me ? "Get a ticket" : afford ? (busy === r.id ? "Buying…" : "Buy") : `Need ${r.cost - me.coins} more`}
              </button>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

/** Whether the board is updating by itself, and when it last did. */
export function LinkState({ link, updatedAt, className = "" }: { link: BoardLink; updatedAt: number | null; className?: string }) {
  if (link === "connecting") return null;
  const at = updatedAt ? new Date(updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
  const [dot, text] = link === "live" ? ["bg-[#1a7f37] animate-pulse motion-reduce:animate-none", "Live"] : link === "polling" ? ["bg-[#9a6700]", "Updating every few seconds"] : ["bg-[#cf222e]", `Offline · last updated ${at}`];
  return <p role="status" className={`inline-flex items-center gap-2 text-[13px] text-mute ${className}`}><span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />{text}</p>;
}

export function LeaderboardPage() {
  const { me } = useEpoch(); const { rows, link, updatedAt } = useLiveLeaderboard(50);
  const still = useReducedMotion();
  return (
    <Frame title="Top earners." sub="Ranked by coins earned at recharge points and prizes. Spending never lowers your rank." aside={<LinkState link={link} updatedAt={updatedAt} />}>
      {rows?.length === 0 && <p className="text-[19px] text-mute">Nobody has earned coins yet. <Link className="text-ink underline" href="/epoch/register">Be first</Link>.</p>}
      <ol className="border-t border-hair">
        {rows?.map((r, i) => (
          <motion.li key={r.id} layout={!still} transition={{ type: "spring", stiffness: 420, damping: 38 }} className={`flex items-center gap-5 border-b border-hair py-5 ${me?.id === r.id ? "-mx-4 rounded-2xl bg-white/60 px-4" : ""}`}>
            <span className="w-8 text-[19px] tabular-nums text-mute">{i + 1}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-[24px] font-medium tracking-[-0.03em]">{r.name}</p><p className={`${label} truncate`}>@{r.handle}{r.climbed > 0 && <span className="ml-2 text-[#1a7f37]">↑ {r.climbed}</span>}{r.gained > 0 && <span key={`${r.id}-${r.earned}`} className="ml-2 inline-block animate-[fade-out_4s_ease-out_forwards] rounded-full bg-[#dafbe1] px-2 tabular-nums text-[#1a7f37] motion-reduce:animate-none">+{r.gained}</span>}</p></div>
            <span className="flex items-center gap-2 text-[24px] font-medium tabular-nums"><Coin size={22} />{r.earned}</span>
          </motion.li>
        ))}
      </ol>
    </Frame>
  );
}

export function AdminPage() {
  const { store, me, ready, refresh } = useEpoch();
  const [code, setCode] = useState(""); const [err, setErr] = useState("");
  const staff = !!me && me.role !== "attendee";
  const printable = BOOTHS.filter((b) => b.kind !== "free");

  if (!ready) return <Frame title="Desk"><div className="h-64" /></Frame>;
  if (!me) return <Frame title="Sign in first."><Link href="/epoch/register" className={btnInk}>Get your ticket</Link></Frame>;
  if (!staff) return (
    <Frame title="Organisers only.">
      <div className={`${glass} max-w-[560px] space-y-4 p-8`}>
        {store?.elevate ? (<>
          <p className="text-mute">Demo mode: enter the organiser code (<code className="break-all">NEXT_PUBLIC_EPOCH_ORGANISER_CODE</code>).</p>
          <div className="flex flex-wrap gap-2"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="organiser code" className={`${field} !py-3`} /><button className={btnInk} onClick={async () => { const r = await store.elevate!(code); if (r.ok) await refresh(); else setErr(r.error); }}>Unlock</button></div>
          {err && <Notice kind="err">{err}</Notice>}
        </>) : <p className="text-mute">Ask the club lead to set your role to <b className="font-medium text-ink">volunteer</b> or <b className="font-medium text-ink">admin</b> in Supabase.</p>}
      </div>
    </Frame>
  );

  return (
    <Frame title="Organiser desk." sub={`Check people in once they've paid at the desk (${STARTER_COINS} ${EPOCH.currency}, once), fix mistakes, and print the booth QR sheet.`} aside={<div className="no-print flex flex-wrap gap-2"><Link href="/epoch/scan" className={btnInk}>Scan a wallet</Link><button onClick={() => window.print()} className={btnSoft}>Print QR sheet</button></div>}>
      <MyPost />
      <FindAttendee />
      <Team />
      <AuditLog />
      <ClubStatsPanel />
      <SignUps />
      <Inbox />
      <FeedbackSummary />
      <h2 className="no-print mb-4 mt-12 text-[28px] font-medium tracking-[-0.03em]">Booth QR codes</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-3">
        {printable.map((b) => (
          <li key={b.id} className={`${glass} flex break-inside-avoid flex-col items-center gap-3 p-6 text-center print:border-black print:bg-white`}>
            <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={qr.booth(b.id)} size={140} level="M" /></div>
            <p className="text-[19px] font-medium leading-tight tracking-[-0.02em]">{b.name}</p>
            <p className={`${label} flex items-center gap-1.5`}><Coin size={14} />{b.kind === "recharge" ? `+${b.coins} once` : `−${b.coins} / session`}</p>
            <p className="text-[10px] text-mute">{qr.booth(b.id)}</p>
            <Link href={`/epoch/kiosk/${b.id}`} className="no-print text-[13px] text-mute underline underline-offset-2 hover:text-ink">Open as a kiosk<span className="sr-only"> for {b.name}</span></Link>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/* Club at a glance: sign-ups per week, what people want to try first, messages and feedback. */
export function ClubStatsPanel() {
  const { store } = useEpoch();
  const [s, setS] = useState<ClubStats | null>(null);
  useEffect(() => {
    if (!store?.joinRequests) return;
    Promise.all([store.joinRequests(), store.messages?.() ?? [], store.feedback?.() ?? []]).then(([j, m, f]) => setS(clubStats(j, m, f)));
  }, [store]);
  const eventName = (d: string) => CLUB.events.find((e) => e.date === d)?.title ?? d;
  const kindName = (k: string) => KINDS.find((x) => x.id === k)?.label ?? k;

  if (!store?.joinRequests) return (
    <section className={`${glass} no-print mb-4 p-6 sm:p-8`}>
      <h2 className="text-[28px] font-medium tracking-[-0.03em]">Club at a glance</h2>
      <p className="mt-2 text-mute">Sign-up, message and feedback numbers show here once the database is connected. Run <code>npm run connect</code> (5 minutes, see the README).</p>
    </section>
  );
  if (!s) return <section className={`${glass} no-print mb-4 h-48 p-8`} aria-busy="true" />;
  const peak = Math.max(1, ...s.weeks.map((w) => w.count)), top = Math.max(1, ...s.firstEvents.map((e) => e.count));
  const tile = (title: string, value: React.ReactNode, note: string) => (
    <div className="rounded-2xl border border-hair bg-white/60 p-5"><p className={label}>{title}</p><p className="mt-1 text-[40px] font-medium leading-none tracking-[-0.04em]">{value}</p><p className="mt-2 text-[14px] text-mute">{note}</p></div>
  );

  return (
    <section className={`${glass} no-print mb-4 p-6 sm:p-8`} aria-labelledby="stats-h">
      <h2 id="stats-h" className="mb-5 text-[28px] font-medium tracking-[-0.03em]">Club at a glance</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {tile("Sign-ups", s.signUps, `+${s.thisWeek} in the last 7 days`)}
        {tile("Messages", s.messages.reduce((a, m) => a + m.count, 0), s.messages.length ? s.messages.map((m) => `${m.count} ${kindName(m.kind).toLowerCase()}`).join(" · ") : "None yet")}
        {tile("Feedback", s.feedback.average ?? "—", s.feedback.count ? `average of ${s.feedback.count} rating${s.feedback.count === 1 ? "" : "s"}, out of 5` : "No ratings yet")}
      </div>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <figure>
          <figcaption className={`${label} mb-3`}>Sign-ups per week</figcaption>
          <ol className="flex h-36 items-end gap-2" aria-label="Sign-ups per week, last 8 weeks">
            {s.weeks.map((w) => (
              <li key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`Week of ${w.start}: ${w.count}`}>
                <span className="text-[12px] text-mute">{w.count || ""}</span>
                <span className={`w-full rounded-md ${w.count ? "bg-[#2da44e]" : "bg-hair"}`} style={{ height: `${Math.max(4, (w.count / peak) * 100)}%` }} />
                <span className="text-[11px] text-mute">{new Date(w.start + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span className="sr-only">{w.count} sign-ups</span>
              </li>
            ))}
          </ol>
        </figure>
        <figure>
          <figcaption className={`${label} mb-3`}>What they want to try first</figcaption>
          {s.firstEvents.length === 0 ? <p className="text-mute">No sign-ups yet.</p> : (
            <ul className="space-y-2.5">
              {s.firstEvents.map((e) => (
                <li key={e.event} className="text-[14.5px]">
                  <div className="flex justify-between gap-3"><span className="truncate">{eventName(e.event)}</span><span className="text-mute">{e.count}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-hair"><div className="h-2 rounded-full bg-ink" style={{ width: `${(e.count / top) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </figure>
      </div>
    </section>
  );
}

/* Club sign-ups from the home page's "Join the club" form (live mode only), with a CSV export. */
export function SignUps() {
  const { store } = useEpoch();
  const [rows, setRows] = useState<JoinRequest[] | null>(null);
  useEffect(() => { store?.joinRequests?.().then(setRows); }, [store]);
  const eventName = (d: string) => CLUB.events.find((e) => e.date === d)?.title ?? d;
  const { me } = useEpoch();
  const [subject, setSubject] = useState(""); const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false); const [result, setResult] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [audience, setAudience] = useState<Audience>("members");
  const [waiting, setWaiting] = useState<number | null>(null);
  useEffect(() => { if (me?.role === "admin") store?.epochInterestCount?.().then(setWaiting); }, [store, me?.role]);
  const count = audience === "epoch" ? waiting ?? 0 : rows?.length ?? 0;
  const send = async () => {
    if (!store?.broadcast) return;
    if (!window.confirm(`Email ${count} people? This can't be undone.`)) return;
    setSending(true); setResult(null);
    const r = await store.broadcast(subject, message, audience); setSending(false);
    if (r.ok) { setResult({ k: "ok", t: `Sent to ${r.sent} of ${r.total}${r.failed ? ` (${r.failed} failed)` : ""}.` }); setSubject(""); setMessage(""); } else setResult({ k: "err", t: r.error });
  };

  const csv = () => {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const body = ["handle,email,first_event,signed_up", ...(rows ?? []).map((r) => [r.handle, r.email, eventName(r.firstEvent), r.createdAt].map(q).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" })); a.download = "club-sign-ups.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <section className={`${glass} no-print mb-4 p-6 sm:p-8`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[28px] font-medium tracking-[-0.03em]">Club sign-ups</h2><p className={label}>From the “Join the club” form on the home page.</p></div>
        {rows && rows.length > 0 && <button onClick={csv} className={btnSoft}>Download CSV</button>}
      </div>
      {!store?.joinRequests ? <p className="text-mute">Connect Supabase to collect sign-ups here. Until then the form uses the club&apos;s form link or email.</p>
        : rows === null ? <p className="text-mute">Loading…</p>
        : rows.length === 0 ? <p className="text-mute">No sign-ups yet.</p>
        : (
          <div className="max-h-[360px] overflow-y-auto" data-lenis-prevent>
            <table className="w-full text-left text-[15px]">
              <thead className="sticky top-0 bg-white text-[13px] text-mute"><tr><th className="py-2 font-normal">GitHub</th><th className="font-normal">Email</th><th className="font-normal">Wants to try</th><th className="text-right font-normal">When</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-hair">
                    <td className="py-2.5"><a className="underline-offset-4 hover:underline" href={`https://github.com/${r.handle}`} target="_blank" rel="noopener">@{r.handle}</a></td>
                    <td className="text-mute">{r.email}</td><td>{eventName(r.firstEvent)}</td>
                    <td className="text-right text-mute">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {store?.broadcast && me?.role === "admin" && (
        <div className="mt-8 border-t border-hair pt-6">
          <h3 className="text-[22px] font-medium tracking-[-0.02em]">Email everyone</h3>
          <p className={`${label} mb-4`}>Goes to everyone on the list you pick who hasn&apos;t unsubscribed. Each email has an unsubscribe link automatically.</p>
          <fieldset className="mb-4 flex flex-wrap gap-2">
            <legend className="sr-only">Who gets it</legend>
            {([["members", `Club sign-ups (${rows?.length ?? 0})`], ["epoch", `Waiting for Epoch dates${waiting === null ? "" : ` (${waiting})`}`]] as const).map(([id, l]) => (
              <label key={id} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-link ${audience === id ? "border-ink bg-ink text-white" : "border-hair"}`}>
                <input type="radio" name="audience" value={id} checked={audience === id} onChange={() => setAudience(id)} className="sr-only" />{l}
              </label>
            ))}
          </fieldset>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject, e.g. GIT Merge 26 is this Monday" className={`${field} mb-3 !py-3`} aria-label="Subject" maxLength={120} />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={"Write your message. A blank line starts a new paragraph; links become clickable."} rows={6} className={`${field} !py-3`} aria-label="Message" maxLength={5000} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button disabled={sending || subject.trim().length < 3 || message.trim().length < 10} onClick={send} className={btnInk}>{sending ? "Sending…" : `Send to ${count} people`}</button>
            {result && <Notice kind={result.k}>{result.t}</Notice>}
          </div>
        </div>
      )}
    </section>
  );
}

/* Messages from the "Get involved" form: core-team applications, sponsors, speakers, questions. */
export function Inbox() {
  const { store } = useEpoch();
  const [rows, setRows] = useState<ClubMessage[] | null>(null);
  const [kind, setKind] = useState("all");
  useEffect(() => { store?.messages?.().then(setRows); }, [store]);
  if (!store?.messages) return null;
  const kindLabel = (k: string) => KINDS.find((x) => x.id === k)?.label ?? k;
  const shown = (rows ?? []).filter((m) => kind === "all" || m.kind === kind);
  return (
    <section className={`${glass} no-print mb-4 p-6 sm:p-8`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[28px] font-medium tracking-[-0.03em]">Messages</h2><p className={label}>From the “Get involved” page. Reply by email — they&apos;re also sent to the club inbox if email is set up.</p></div>
        <div className="flex flex-wrap gap-2">{[["all", "All"], ...KINDS.map((k) => [k.id, k.label])].map(([id, l]) => <button key={id} onClick={() => setKind(id)} className={`rounded-full border px-3.5 py-1.5 text-[13px] ${kind === id ? "border-ink bg-ink text-white" : "border-hair"}`}>{l}</button>)}</div>
      </div>
      {rows === null ? <p className="text-mute">Loading…</p> : shown.length === 0 ? <p className="text-mute">No messages yet.</p> : (
        <ul className="max-h-[420px] divide-y divide-hair overflow-y-auto" data-lenis-prevent>
          {shown.map((m) => (
            <li key={m.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">{m.name} <span className="ml-2 rounded-full bg-ink/[.07] px-2.5 py-0.5 text-[12px] font-normal">{kindLabel(m.kind)}</span></p><span className="text-[13px] text-mute">{new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>
              <p className="mt-0.5 text-[14px] text-mute"><a className="underline underline-offset-2" href={`mailto:${m.email}`}>{m.email}</a>{m.handle && <> · <a className="underline underline-offset-2" href={`https://github.com/${m.handle}`} target="_blank" rel="noopener">@{m.handle}</a></>}</p>
              <p className="mt-2 whitespace-pre-wrap text-[15.5px] leading-relaxed">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* Anonymous feedback from the event pages: average rating per event, and what people wrote. */
export function FeedbackSummary() {
  const { store } = useEpoch();
  const [rows, setRows] = useState<EventFeedback[] | null>(null);
  useEffect(() => { store?.feedback?.().then(setRows); }, [store]);
  if (!store?.feedback) return null;
  const events = CLUB.events.map((e) => ({ e, list: (rows ?? []).filter((f) => f.event === e.date) })).filter((x) => x.list.length);
  return (
    <section className={`${glass} no-print mb-4 p-6 sm:p-8`}>
      <h2 className="text-[28px] font-medium tracking-[-0.03em]">Event feedback</h2>
      <p className={`${label} mb-4`}>Anonymous. Collected on each event&apos;s page after the date.</p>
      {rows === null ? <p className="text-mute">Loading…</p> : events.length === 0 ? <p className="text-mute">No feedback yet.</p> : (
        <ul className="space-y-6">
          {events.map(({ e, list }) => {
            const avg = list.reduce((s, f) => s + f.rating, 0) / list.length;
            return (
              <li key={e.date}>
                <p className="flex flex-wrap items-baseline gap-x-3 text-[19px] font-medium">{e.title}<span className="text-[15px] font-normal text-mute">★ {avg.toFixed(1)} · {list.length} response{list.length === 1 ? "" : "s"}</span></p>
                <ul className="mt-2 max-h-[220px] space-y-2 overflow-y-auto" data-lenis-prevent>
                  {list.filter((f) => f.liked || f.improve).map((f) => (
                    <li key={f.id} className="rounded-xl bg-ink/[.04] px-4 py-3 text-[14.5px] leading-relaxed">
                      <span className="font-mono text-[12px] text-mute">{"★".repeat(f.rating)}</span>
                      {f.liked && <p><b className="font-medium">Liked:</b> {f.liked}</p>}
                      {f.improve && <p><b className="font-medium">Improve:</b> {f.improve}</p>}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
