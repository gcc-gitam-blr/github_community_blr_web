"use client";
import { useEffect, useMemo, useState } from "react";
import { StarFillIcon } from "@primer/octicons-react";
import { useEpoch } from "@/components/epoch/EpochProvider";
import { useConfirm } from "@/components/ui/Confirm";
import { exportSignups } from "@/lib/admin/client";
import { csvCell } from "@/lib/admin/members";
import { CLUB } from "@/lib/config";
import { KINDS } from "@/lib/contact";
import { clubStats } from "@/lib/stats";
import type { Audience, ClubMessage, EventFeedback, JoinRequest } from "@/lib/epoch/types";
import { Note, btn, btnSoft, card, count, head, input } from "./kit";

/* The club's front door, as the core team sees it: who signed up, who wrote in, what people thought of each event,
   and the one email that goes to everyone. Moved here from the Epoch desk's glass panels so the admin is one product. */
const eventName = (d: string) => CLUB.events.find((e) => e.date === d)?.title ?? d;
const kindName = (k: string) => KINDS.find((x) => x.id === k)?.label ?? k;
const short = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const SHOWN = 6; // the rest wait behind "Show all": no long lists

/** Sign-ups as a contribution graph: one square a day for the last 12 weeks, greener on busier days (like the home page's year). */
function SignupGraph({ joins }: { joins: JoinRequest[] }) {
  const { weeks, total, best } = useMemo(() => {
    const perDay = joins.reduce((m, j) => { const k = ymd(new Date(j.createdAt)); return m.set(k, (m.get(k) ?? 0) + 1); }, new Map<string, number>());
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay() - 7 * 11); // Sunday, 11 weeks back
    const weeks = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => { const x = new Date(start); x.setDate(start.getDate() + w * 7 + d); const k = ymd(x); return { k, n: perDay.get(k) ?? 0, future: x > new Date() }; }));
    const days = weeks.flat(), total = days.reduce((a, d) => a + d.n, 0);
    const best = days.reduce((b, d) => (d.n > b.n ? d : b), { k: "", n: 0, future: false });
    return { weeks, total, best };
  }, [joins]);
  const peak = Math.max(1, best.n);
  const shade = (n: number) => (n === 0 ? "bg-[#ebeef0]" : n / peak <= 0.25 ? "bg-[#9be9a8]" : n / peak <= 0.5 ? "bg-[#40c463]" : n / peak <= 0.75 ? "bg-[#30a14e]" : "bg-[#216e39]");
  const summary = `${total} sign-up${total === 1 ? "" : "s"} in the last 12 weeks${best.n ? `, most on ${short(best.k + "T00:00:00")} (${best.n})` : ""}`;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 text-[13.5px] text-ink-2">Sign-ups, last 12 weeks</figcaption>
      <div className="overflow-x-auto pb-1">
        <div role="img" aria-label={summary} className="flex w-max gap-[3px]">
          {weeks.map((w, i) => (
            <div key={i} className="grid grid-rows-7 gap-[3px]">
              {w.map((d) => <span key={d.k} title={d.future ? undefined : `${short(d.k + "T00:00:00")}: ${d.n}`} className={`block h-[13px] w-[13px] rounded-[3px] ${d.future ? "bg-transparent" : shade(d.n)}`} />)}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 font-mono text-[11.5px] text-ink-3" aria-hidden>
        Less {["bg-[#ebeef0]", "bg-[#9be9a8]", "bg-[#40c463]", "bg-[#30a14e]", "bg-[#216e39]"].map((c) => <span key={c} className={`h-[11px] w-[11px] rounded-[2px] ${c}`} />)} More
      </p>
    </figure>
  );
}

/* The overview's second half: the club at a glance. */
export function ClubPulse() {
  const { store } = useEpoch();
  const [data, setData] = useState<{ j: JoinRequest[]; m: ClubMessage[]; f: EventFeedback[] } | null>(null);
  useEffect(() => {
    if (!store?.joinRequests) return;
    void Promise.all([store.joinRequests(), store.messages?.() ?? [], store.feedback?.() ?? []]).then(([j, m, f]) => setData({ j, m, f }));
  }, [store]);
  if (!store?.joinRequests) return null;
  if (!data) return <section className={`${card} h-56`} aria-busy="true" />;
  const s = clubStats(data.j, data.m, data.f), top = Math.max(1, ...s.firstEvents.map((e) => e.count));
  const tile = (label: string, value: React.ReactNode, note: React.ReactNode, href: string) => (
    <a href={href} className="group block min-w-0 px-3.5 py-4 transition-colors duration-150 hover:bg-soft sm:px-6 sm:py-5">
      <p className="text-[12.5px] text-ink-2 sm:text-[13.5px]">{label}</p>
      <p className="mt-1 font-display text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums sm:text-[40px]">{value}</p>
      <p className="mt-2 text-[12.5px] leading-snug text-ink-3 sm:text-[13.5px]">{note}</p>
    </a>
  );
  return (
    <section className={card} aria-labelledby="pulse-h">
      <div className={head}><h2 id="pulse-h" className="text-[18px]">The club at a glance</h2></div>
      <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
        {tile("Sign-ups", s.signUps, <span className={s.thisWeek ? "font-mono font-semibold text-[#116329]" : ""}>{s.thisWeek ? `+${s.thisWeek} this week` : "None this week"}</span>, "#signups")}
        {tile("Messages", s.messages.reduce((a, m) => a + m.count, 0), s.newMessages ? `${s.newMessages} new this week` : "None new this week", "#messages")}
        {tile("Event rating", s.feedback.average ?? "–", s.feedback.count ? `out of 5, from ${s.feedback.count} rating${s.feedback.count === 1 ? "" : "s"}` : "No ratings yet", "#feedback")}
      </div>
      <div className="grid gap-8 p-5 sm:p-6 md:grid-cols-2">
        <SignupGraph joins={data.j} />
        <figure>
          <figcaption className="mb-3 text-[13.5px] text-ink-2">What new people want to try first</figcaption>
          {s.firstEvents.length === 0 ? <p className="text-[14.5px] text-ink-3">No sign-ups yet.</p> : (
            <ul className="space-y-3">
              {s.firstEvents.slice(0, 4).map((e) => (
                <li key={e.event} className="text-[14.5px]">
                  <div className="flex justify-between gap-3"><span className="truncate">{eventName(e.event)}</span><span className="font-mono text-ink-2">{e.count}</span></div>
                  <div className="mt-1.5 h-2 rounded-full bg-soft"><div className="h-2 rounded-full bg-[#2da44e]" style={{ width: `${(e.count / top) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </figure>
      </div>
    </section>
  );
}

/* Sign-ups from the home page's "Join the club" form, the CSV, and (admins) one email to everyone. */
export function SignUps() {
  const { store, me } = useEpoch();
  const [rows, setRows] = useState<JoinRequest[] | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => { void store?.joinRequests?.().then(setRows); }, [store]);
  const [subject, setSubject] = useState(""); const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false); const [result, setResult] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [audience, setAudience] = useState<Audience>("members");
  const [waiting, setWaiting] = useState<number | null>(null);
  const [month, setMonth] = useState(""); const [drafting, setDrafting] = useState(false);
  // fills the form with a draft of that month's newsletter (empty month = the usual one); nothing is sent until Send
  const draft = async () => {
    setDrafting(true); setResult(null);
    try { const d = await (await fetch(`/api/newsletter${month ? `?month=${month}` : ""}`)).json(); setSubject(d.subject); setMessage(d.message); if (!month) setMonth(d.month); }
    catch { setResult({ k: "err", t: "Couldn't build the draft. Try again." }); }
    setDrafting(false);
  };
  useEffect(() => { if (me?.role === "admin") void store?.epochInterestCount?.().then(setWaiting); }, [store, me?.role]);
  const people = audience === "epoch" ? waiting ?? 0 : rows?.length ?? 0;
  const [ask, dialog] = useConfirm();
  const send = async () => {
    if (!store?.broadcast) return;
    if (!(await ask({ title: `Email ${people} ${people === 1 ? "person" : "people"}?`, body: <>Subject: <b>{subject || "(no subject)"}</b>. Emails can&apos;t be called back once they&apos;re sent.</>, yes: `Send to ${people}` }))) return;
    setSending(true); setResult(null);
    const r = await store.broadcast(subject, message, audience); setSending(false);
    if (r.ok) { setResult({ k: "ok", t: `Sent to ${r.sent} of ${r.total}${r.failed ? ` (${r.failed} failed)` : ""}.` }); setSubject(""); setMessage(""); } else setResult({ k: "err", t: r.error });
  };
  const csv = async () => {
    const list = await exportSignups(); // goes through a database function, so every download is recorded in the audit log
    if (!list) return setResult({ k: "err", t: "Couldn't export. Please try again." });
    const body = ["name,github,email,first_event,signed_up", ...list.map((r) => [r.name ?? "", r.handle ?? "", r.email, r.first_event ? eventName(r.first_event) : "", r.created_at].map(csvCell).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" })); a.download = "club-sign-ups.csv"; a.click(); URL.revokeObjectURL(a.href);
  };
  const shown = all ? rows ?? [] : (rows ?? []).slice(0, SHOWN * 2);

  return (
    <>
      {dialog}
      <section className={card} aria-labelledby="signups-h">
        <div className={head}>
          <h2 id="signups-h" className="text-[18px]">Club sign-ups</h2>{rows && <span className={count}>{rows.length}</span>}
          <span className="text-[13.5px] text-ink-3">From every Join the club form: the home page, /join, and event and update pages</span>
          {rows && rows.length > 0 && <button onClick={csv} className={`${btnSoft} ml-auto`}>Download CSV</button>}
        </div>
        {!store?.joinRequests ? <p className="p-5 text-ink-3">Connect the database to collect sign-ups here.</p>
          : rows === null ? <div className="h-32" aria-busy="true" />
          : rows.length === 0 ? <p className="p-5 text-ink-3">No sign-ups yet. They appear here the moment someone joins from the home page.</p>
          : (<>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[14.5px]">
                <thead className="bg-soft text-[13px] text-ink-2"><tr><th className="px-5 py-2 font-normal">Name</th><th className="font-normal">GitHub</th><th className="font-normal">Email</th><th className="font-normal">Wants to try</th><th className="px-5 text-right font-normal">Joined</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="px-5 py-2.5 font-semibold">{r.name ?? <span className="font-normal text-ink-3">no name</span>}</td>
                      <td>{r.handle ? <a className="underline-offset-4 hover:underline" href={`https://github.com/${r.handle}`} target="_blank" rel="noopener">@{r.handle}</a> : <span className="text-ink-3">not added yet</span>}</td>
                      <td className="text-ink-2">{r.email}</td><td>{r.firstEvent ? eventName(r.firstEvent) : <span className="text-ink-3">not picked</span>}</td>
                      <td className="whitespace-nowrap px-5 text-right text-ink-3">{short(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > shown.length && <button onClick={() => setAll(true)} className="w-full border-t border-line px-5 py-3 text-left text-[14px] font-semibold text-link hover:bg-soft">Show all {rows.length}</button>}
          </>)}
      </section>

      {store?.broadcast && me?.role === "admin" && (
        <section className={card} aria-labelledby="email-h">
          <div className={head}><h2 id="email-h" className="text-[18px]">Email everyone</h2><span className="text-[13.5px] text-ink-3">Only people who haven&apos;t unsubscribed; every email carries an unsubscribe link</span></div>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-soft p-3">
              <label htmlFor="nl-month" className="text-[14px] font-semibold">Monthly newsletter</label>
              <input id="nl-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${input} !w-auto !py-1.5`} />
              <button type="button" onClick={draft} disabled={drafting} className={btnSoft}>{drafting ? "Drafting…" : "Draft it"}</button>
              <span className="text-[13px] text-ink-3">Fills the form from that month&apos;s events, recaps, news and merges. Read it, edit it, then send.</span>
            </div>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-2 text-[14px] font-semibold">Who gets it</legend>
              {([["members", `Club sign-ups (${rows?.length ?? 0})`], ["epoch", `Waiting for Epoch dates${waiting === null ? "" : ` (${waiting})`}`]] as const).map(([id, l]) => (
                <label key={id} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-link ${audience === id ? "border-ink bg-ink font-semibold text-white" : "border-line hover:border-ink/40"}`}>
                  <input type="radio" name="audience" value={id} checked={audience === id} onChange={() => setAudience(id)} className="sr-only" />{l}
                </label>
              ))}
            </fieldset>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject, e.g. GIT Merge 26 is this Monday" className={input} aria-label="Subject" maxLength={120} />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={"Write your message. A blank line starts a new paragraph; links become clickable."} rows={7} className={input} aria-label="Message" maxLength={5000} />
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={sending || subject.trim().length < 3 || message.trim().length < 10} onClick={send} className={btn}>{sending ? "Sending…" : `Send to ${people} ${people === 1 ? "person" : "people"}`}</button>
              <Note note={result} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/* Messages from the "Get involved" form: core-team applications, sponsors, speakers, questions. */
export function Inbox() {
  const { store } = useEpoch();
  const [rows, setRows] = useState<ClubMessage[] | null>(null);
  const [kind, setKind] = useState("all");
  const [all, setAll] = useState(false);
  useEffect(() => { void store?.messages?.().then(setRows); }, [store]);
  if (!store?.messages) return null;
  const list = (rows ?? []).filter((m) => kind === "all" || m.kind === kind);
  const shown = all ? list : list.slice(0, SHOWN);
  const kinds = [["all", "All"], ...KINDS.filter((k) => (rows ?? []).some((m) => m.kind === k.id)).map((k) => [k.id, k.label])];
  return (
    <section className={card} aria-labelledby="inbox-h">
      <div className={head}>
        <h2 id="inbox-h" className="text-[18px]">Messages</h2>{rows && <span className={count}>{rows.length}</span>}
        <span className="text-[13.5px] text-ink-3">From the &ldquo;Get involved&rdquo; page. Reply by email.</span>
      </div>
      {kinds.length > 2 && (
        <div role="group" aria-label="Show messages about" className="flex flex-wrap gap-1.5 border-b border-line px-5 py-2.5">
          {kinds.map(([id, l]) => <button key={id} aria-pressed={kind === id} onClick={() => { setKind(id); setAll(false); }} className={`rounded-full px-3 py-1 text-[13.5px] transition-colors duration-150 ${kind === id ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{l}</button>)}
        </div>
      )}
      {rows === null ? <div className="h-32" aria-busy="true" /> : list.length === 0 ? <p className="p-5 text-ink-3">No messages yet.</p> : (
        <ul className="divide-y divide-line">
          {shown.map((m) => (
            <li key={m.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-semibold">{m.name}</p>
                <span className="rounded-full bg-soft px-2 py-[3px] text-[12.5px] font-semibold leading-none text-ink-2">{kindName(m.kind)}</span>
                <span className="ml-auto text-[13px] text-ink-3">{short(m.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-[14px] text-ink-2"><a className="underline underline-offset-2" href={`mailto:${m.email}`}>{m.email}</a>{m.handle && <> · <a className="underline underline-offset-2" href={`https://github.com/${m.handle}`} target="_blank" rel="noopener">@{m.handle}</a></>}</p>
              <p className="mt-2 max-w-[70ch] whitespace-pre-wrap text-[15px] leading-relaxed">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
      {list.length > shown.length && <button onClick={() => setAll(true)} className="w-full border-t border-line px-5 py-3 text-left text-[14px] font-semibold text-link hover:bg-soft">Show all {list.length}</button>}
    </section>
  );
}

/** Five stars, the first `n` (rounded) filled. Drawn, not typed, so they're a picture of the rating rather than text. */
function Stars({ n, size = 14, label = false }: { n: number; size?: number; label?: boolean }) {
  const full = Math.round(n);
  return (
    <span role={label ? "img" : undefined} aria-label={label ? `${full} of 5` : undefined} aria-hidden={label ? undefined : true} className="inline-flex gap-px align-[-1px]">
      {[1, 2, 3, 4, 5].map((i) => <StarFillIcon key={i} size={size} className={i <= full ? "fill-[#d4a72c]" : "fill-line"} />)}
    </span>
  );
}

/* Anonymous feedback from the event pages: one card per event with its rating, and what people wrote. */
export function FeedbackSummary() {
  const { store } = useEpoch();
  const [rows, setRows] = useState<EventFeedback[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { void store?.feedback?.().then(setRows); }, [store]);
  if (!store?.feedback) return null;
  const events = CLUB.events.map((e) => ({ e, list: (rows ?? []).filter((f) => f.event === e.date) })).filter((x) => x.list.length).reverse();
  return (
    <section className={card} aria-labelledby="fb-h">
      <div className={head}><h2 id="fb-h" className="text-[18px]">Event feedback</h2><span className="text-[13.5px] text-ink-3">Anonymous. Asked on each event&apos;s page after the day.</span></div>
      {rows === null ? <div className="h-32" aria-busy="true" /> : events.length === 0 ? <p className="p-5 text-ink-3">No feedback yet. It appears here once an event has happened and people answer on its page.</p> : (
        <ul className="divide-y divide-line">
          {events.map(({ e, list }) => {
            const avg = list.reduce((s, f) => s + f.rating, 0) / list.length;
            const said = list.filter((f) => f.liked || f.improve), more = open === e.date ? said : said.slice(0, 3);
            return (
              <li key={e.date} className="px-5 py-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p className="font-display text-[17px] font-bold">{e.title}</p>
                  <p className="flex items-center gap-2 text-[14px] text-ink-2">
                    <Stars n={avg} />
                    <b className="font-mono text-ink">{avg.toFixed(1)}</b><span>from {list.length} {list.length === 1 ? "person" : "people"}</span>
                  </p>
                </div>
                {said.length > 0 && (
                  <ul className="mt-3 grid gap-2 md:grid-cols-2">
                    {more.map((f) => (
                      <li key={f.id} className="rounded-md bg-soft px-4 py-3 text-[14.5px] leading-relaxed">
                        <Stars n={f.rating} size={12} label />
                        {f.liked && <p><b className="font-semibold">Liked:</b> {f.liked}</p>}
                        {f.improve && <p><b className="font-semibold">Improve:</b> {f.improve}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                {said.length > more.length && <button onClick={() => setOpen(e.date)} className="mt-2 text-[14px] font-semibold text-link underline-offset-4 hover:underline">Read all {said.length}</button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
