"use client";
import { useEffect, useState } from "react";
import { MarkGithubIcon } from "@primer/octicons-react";
import { minutesDoc, proposalDoc, signedInUser, type Proposal, type RosterPerson } from "@/lib/admin/client";
import { hasSupabase } from "@/lib/epoch/store";
import { CLUB } from "@/lib/config";

/* The two documents the university asks for, in its own formats, ready to save as a PDF and send:
   an event proposal (a two-column table) and the minutes of a meeting. Opened from the admin
   (/admin/doc?proposal=12 or ?minutes=3); the data is read as the signed-in organiser, as everywhere else. */
type Minutes = NonNullable<Awaited<ReturnType<typeof minutesDoc>>>;
type Loaded = { kind: "proposal"; p: Proposal; by: string | null } | ({ kind: "minutes" } & Minutes);
type State = "loading" | "signin" | "missing" | Loaded;

const longDate = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const dotDate = (d: string) => d.split("-").reverse().join(".");
/** "16:00" → "4 PM", "17:30" → "5:30 PM" */
const clock = (t?: string) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`; };
const MODE = { offline: "Offline", online: "Online", hybrid: "Hybrid" } as const;

/** **bold** where someone typed it; in a list, "Lead: the rest" makes the lead bold, like the university's samples. */
function Inline({ text, lead = false }: { text: string; lead?: boolean }) {
  const m = lead && !text.includes("**") ? text.match(/^([^:.]{2,60}):\s+(.+)$/) : null;
  if (m) return <><b>{m[1]}:</b> {m[2]}</>;
  return <>{text.split(/(\*\*[^*]+\*\*)/).map((s, i) => (s.startsWith("**") && s.endsWith("**") ? <b key={i}>{s.slice(2, -2)}</b> : s))}</>;
}
/** Paragraphs, with lines starting "- " or "• " gathered into bullet lists. `list` makes every line a bullet. */
function Rich({ text, list = false, lead = false }: { text?: string | null; list?: boolean; lead?: boolean }) {
  const lines = (text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocks: ({ ul: string[] } | { p: string })[] = [];
  for (const l of lines) {
    const bullet = list || /^[-•*]\s+/.test(l), body = l.replace(/^[-•*]\s+/, "");
    const last = blocks[blocks.length - 1];
    if (bullet) { if (last && "ul" in last) last.ul.push(body); else blocks.push({ ul: [body] }); } else blocks.push({ p: body });
  }
  return <>{blocks.map((b, i) => ("ul" in b ? <ul key={i}>{b.ul.map((x, j) => <li key={j}><Inline text={x} lead={lead} /></li>)}</ul> : <p key={i}><Inline text={b.p} /></p>))}</>;
}
const Logo = ({ src, alt }: { src?: string; alt: string }) =>
  // eslint-disable-next-line @next/next/no-img-element
  src ? <img src={src} alt={alt} className="doc-logo" /> : <span className="doc-logo" aria-hidden />;
const todo = <span className="doc-todo">To be added</span>;

function ProposalPage({ p }: { p: Proposal }) {
  const d = p.details ?? {};
  const rows: [string, React.ReactNode][] = [
    ["Event Name", p.title],
    ["Date(s)", d.date_tbd ? "Yet to be decided" : longDate(p.proposed_date)],
    ["Number of Days", String(d.days ?? 1)],
    ["Time", d.time || "Yet to be decided"],
    ["Location Mode (Online/Offline)", `${MODE[d.mode ?? "offline"]}-${p.venue}`],
    ["Purpose of Event", <Rich key="o" text={p.objective} />],
    ["Target Audience", d.audience || todo],
    ["Expected Number of Entries", p.expected_attendance ? `${p.expected_attendance}+ students` : todo],
    ["Event Description", d.description ? <Rich key="d" text={d.description} /> : todo],
    ["Learning Outcomes", d.outcomes ? <Rich key="l" text={d.outcomes} list lead /> : todo],
    ["Requirements", d.requirements ? <Rich key="r" text={d.requirements} list /> : todo],
    ...(p.budget_inr !== null && p.budget_inr !== undefined ? [["Budget", `₹${p.budget_inr.toLocaleString("en-IN")}`] as [string, React.ReactNode]] : []),
  ];
  return (
    <article className="doc-page doc-sans">
      <header className="doc-head"><Logo src={CLUB.docs.studentLifeLogo} alt="GITAM Student Life" /><MarkGithubIcon size={52} aria-label="GitHub" /></header>
      <h1 className="doc-title">{p.title}</h1>
      <table className="doc-table"><tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
    </article>
  );
}

function MinutesPage({ m, roster, decisions, tasks, notes }: Minutes) {
  const d = m.details ?? {};
  const everyone = [...roster.present, ...roster.absent];
  const find = (id?: string) => everyone.find((x) => x.id === id);
  // the chair and recorder when they were picked; otherwise whoever holds the usual title and came
  const chair = find(d.chair) ?? roster.present.find((x) => /president|lead/i.test(x.title ?? ""));
  const recorder = find(d.recorder) ?? roster.present.find((x) => /secretary/i.test(x.title ?? ""));
  const who = (x: RosterPerson) => `${x.name}${x.title ? `, ${x.title}` : ""}`;
  return (
    <article className="doc-page doc-serif">
      {(CLUB.docs.universityLogo || CLUB.docs.studentLifeLogo) && <header className="doc-head"><Logo src={CLUB.docs.universityLogo} alt="GITAM" /><Logo src={CLUB.docs.studentLifeLogo} alt="GITAM Student Life" /></header>}
      <h1 className="doc-title">GitHub Community Club Meeting<br />Minutes of Meeting</h1>
      <p className="doc-meta"><span><b>Date:</b> {dotDate(m.held_on)}</span><span>{d.starts && <><b>Time</b>: {clock(d.starts)} </>}<b>Mode:</b> {MODE[d.mode ?? "offline"]}{d.venue ? `, ${d.venue}` : ""}</span></p>
      {m.agenda && <><p><b>Agenda:</b></p><Rich text={m.agenda} list /></>}
      {chair && <p className="doc-chair">The meeting was chaired by {chair.name}{chair.title ? ` - the Club ${chair.title}` : ""}</p>}
      <p><b>Attendees:</b></p>
      {roster.present.length ? roster.present.map((x) => <p key={x.id} className="doc-person">{who(x)}</p>) : <p className="doc-person">Not recorded</p>}
      <p><b>Absentees:</b></p>
      {roster.absent.length ? roster.absent.map((x) => <p key={x.id} className="doc-person">{who(x)}</p>) : <p className="doc-person">None</p>}
      <p><b>Recorded Minutes:</b></p>
      {m.minutes ? <Rich text={m.minutes} /> : <p>{todo}</p>}
      {decisions.length > 0 && <><p><b>Decisions:</b></p><ul>{decisions.map((x) => <li key={x.id}><b>{x.title}:</b> {x.decision}{x.status === "superseded" ? " (later superseded)" : ""}</li>)}</ul></>}
      {tasks.length > 0 && <><p><b>Action items:</b></p><ul>{tasks.map((x) => <li key={x.id}>{x.title} ({x.owner ? `${x.owner}, ` : ""}by {dotDate(x.due_on)})</li>)}</ul></>}
      {notes.length > 0 && <><p><b>Added after the minutes were final:</b></p><ul>{notes.map((x) => <li key={x.id}>{x.note} ({dotDate(x.created_at.slice(0, 10))})</li>)}</ul></>}
      {d.ends && <p><b>Adjournment:</b> The meeting was adjourned at {clock(d.ends)}{chair ? ` by the ${(chair.title || "chair").toLowerCase()}` : ""}.</p>}
      <p><b>Minutes recorded by</b>: {recorder ? who(recorder) : todo}</p>
    </article>
  );
}

export function OfficialDoc() {
  const [state, setState] = useState<State>("loading");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const proposal = Number(q.get("proposal")), minutes = Number(q.get("minutes"));
    void (async () => {
      if (!hasSupabase) return setState("missing");
      if (!(await signedInUser())) return setState("signin");
      if (proposal > 0) { const r = await proposalDoc(proposal); setState(r ? { kind: "proposal", ...r } : "missing"); }
      else if (minutes > 0) { const r = await minutesDoc(minutes); setState(r ? { kind: "minutes", ...r } : "missing"); }
      else setState("missing");
    })();
  }, []);
  // the PDF is named after the page title
  useEffect(() => {
    if (typeof state !== "object") return;
    document.title = state.kind === "proposal" ? `Event Proposal - ${state.p.title}` : `Minutes of Meeting - ${dotDate(state.m.held_on)}`;
  }, [state]);

  const back = typeof state === "object" ? (state.kind === "proposal" ? "/admin#proposals" : "/admin#meetings") : "/admin";
  const note = typeof state === "object" && state.kind === "minutes" && !state.m.minutes_finalised_at ? "These minutes aren't final yet." : null;
  return (
    <div data-light-only className="doc-wrap">
      <div className="doc-toolbar">
        <a href={back} className="doc-back">← Back to the admin</a>
        {typeof state === "object" && <>
          <span className="doc-tip">{note ? <b>{note} </b> : null}In the window that opens, choose <b>Save as PDF</b>.</span>
          <button onClick={() => window.print()} className="doc-print">Download PDF</button>
        </>}
      </div>
      {state === "loading" && <div className="doc-page" aria-busy="true" />}
      {state === "signin" && <p className="doc-msg">Sign in at <a href="/admin">/admin</a> first, then open the document again.</p>}
      {state === "missing" && <p className="doc-msg">That document isn&apos;t available. It may not exist, or it&apos;s for the core team and admins only.</p>}
      {typeof state === "object" && (state.kind === "proposal" ? <ProposalPage p={state.p} /> : <MinutesPage {...state} />)}
    </div>
  );
}
