"use client";
import { useMemo, useState } from "react";
import { postIdea, requestToJoin, withdrawRequest, type Idea, type JoinRequest, type TeamMember } from "@/lib/hub/client";
import { DOMAINS, IDEA_STATUS, LIMITS, domainLabel } from "@/lib/projects";
import { IdeaForm, Notice, Tags, btn, btnSoft, field, linkBtn, type Say } from "./bits";

/* Project ideas: browse what is looking for people, ask to join, or share your own. One group at a time. */
type Names = Record<string, { handle: string; name: string }>;
const OPEN: Idea["status"][] = ["idea", "forming", "building"];

export function Ideas({ uid, data, names, reload }: { uid: string; data: { ideas: Idea[]; team: TeamMember[]; requests: JoinRequest[] }; names: Names; reload: () => Promise<void> }) {
  const [area, setArea] = useState(""); const [show, setShow] = useState<"open" | "mine" | "shipped">("open");
  const [say, setSay] = useState<Say>(null); const [busy, setBusy] = useState(false); const [sharing, setSharing] = useState(false);
  const mineIds = useMemo(() => new Set(data.team.filter((t) => t.user_id === uid).map((t) => t.project_id)), [data, uid]);
  const rows = useMemo(() => data.ideas.filter((i) => (area ? i.domains.includes(area) : true) && (show === "open" ? OPEN.includes(i.status) && !mineIds.has(i.id) : show === "mine" ? mineIds.has(i.id) && i.status !== "archived" : i.status === "shipped")), [data, area, show, mineIds]);
  const run = async (p: Promise<{ ok: boolean; error?: string }>, done: string) => { setBusy(true); setSay(null); const r = await p; setBusy(false); setSay(r.ok ? { k: "ok", t: done } : { k: "err", t: (r as { error: string }).error }); if (r.ok) await reload(); return r.ok; };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Which ideas" className="flex flex-wrap gap-1">
          {([["open", "Looking for people"], ["mine", "My projects"], ["shipped", "Shipped"]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={show === k} onClick={() => setShow(k)} className={`rounded-md px-3.5 py-2 text-[15px] ${show === k ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{label}</button>
          ))}
        </div>
        <label className="ml-auto text-[14px]"><span className="sr-only">Filter by area</span>
          <select value={area} onChange={(e) => setArea(e.target.value)} className={`${field} !w-auto !py-2`}><option value="">Every area</option>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
        <button onClick={() => setSharing(!sharing)} aria-expanded={sharing} className={btnSoft}>{sharing ? "Close" : "Share an idea"}</button>
      </div>
      <Notice say={say} />
      {sharing && (
        <section className="rounded-[18px] border-2 border-ink bg-white p-6 sm:p-8" aria-labelledby="share-h">
          <h2 id="share-h" className="text-[24px]">Share a project idea</h2>
          <p className="mt-1 mb-5 text-[15.5px] text-ink-2">Say what you want to build and who you need. People can ask to join, and you choose who is on the team.</p>
          <IdeaForm busy={busy} submit={async (f) => { const ok = await run(postIdea(f), "Shared. People can now ask to join."); if (ok) { setSharing(false); setShow("mine"); } return ok; }} cancel={() => setSharing(false)} />
        </section>
      )}
      {rows.length === 0 ? <p className="rounded-xl border border-line bg-white p-6 text-ink-2">{show === "open" ? "No ideas are looking for people in this area yet. Share one." : show === "mine" ? "You aren't on any project yet. Ask to join one, or share your own." : "Nothing has shipped yet."}</p> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((i) => <IdeaCard key={i.id} i={i} uid={uid} team={data.team.filter((t) => t.project_id === i.id)} mine={data.requests.find((r) => r.project_id === i.id && r.user_id === uid)} owner={names[i.owner_id ?? ""]} busy={busy} run={run} />)}
        </ul>
      )}
    </div>
  );
}

function IdeaCard({ i, uid, team, mine, owner, busy, run }: { i: Idea; uid: string; team: TeamMember[]; mine?: JoinRequest; owner?: { handle: string; name: string }; busy: boolean; run: (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean> }) {
  const [asking, setAsking] = useState(false); const [msg, setMsg] = useState("");
  const onTeam = team.some((t) => t.user_id === uid), full = i.team_size !== null && team.length >= i.team_size, open = OPEN.includes(i.status);
  return (
    <li className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[12.5px]">{IDEA_STATUS[i.status]}</span>{i.origin === "club" && <span className="rounded-full bg-[#dafbe1] px-2.5 py-0.5 text-[12.5px] font-semibold text-[#116329]">Club project</span>}</div>
      <h3 className="text-[20px] leading-snug">{i.title}</h3>
      <p className="text-[15.5px] text-ink-2">{i.summary}</p>
      <Tags items={i.domains} label={domainLabel} />
      {i.skills_wanted.length > 0 && <p className="text-[14px] text-ink-3">Looking for: <span className="font-mono text-ink-2">{i.skills_wanted.join(", ")}</span></p>}
      <p className="text-[14px] text-ink-3">{team.length}{i.team_size ? ` of ${i.team_size}` : ""} on the team{owner ? <> · by <a className="underline underline-offset-2" href={`https://github.com/${owner.handle}`} target="_blank" rel="noopener">@{owner.handle}</a></> : ""}{i.repo_url ? <> · <a className="underline underline-offset-2" href={i.repo_url} target="_blank" rel="noopener noreferrer">repository</a></> : ""}</p>
      {onTeam ? <p className="text-[14.5px] font-semibold text-[#116329]">You are on this team. Manage it under My teams.</p>
        : mine?.status === "pending" ? <p className="flex flex-wrap items-center gap-3 text-[14.5px]"><span className="font-semibold">Request sent.</span><button disabled={busy} onClick={() => void run(withdrawRequest(mine.id), "Request withdrawn.")} className={linkBtn}>Withdraw</button></p>
        : mine?.status === "declined" ? <p className="text-[14.5px] text-ink-3">The owner has answered your request.</p>
        : open && !full ? (asking ? (
          <form onSubmit={(e) => { e.preventDefault(); void run(requestToJoin(i.id, msg), "Request sent. The owner will answer.").then((ok) => ok && setAsking(false)); }} className="space-y-2">
            <label className="block text-[14px] font-medium" htmlFor={`m-${i.id}`}>A line for the owner <span className="font-normal text-ink-3">(what you could help with)</span></label>
            <textarea id={`m-${i.id}`} rows={2} className={field} value={msg} maxLength={LIMITS.message} onChange={(e) => setMsg(e.target.value)} />
            <div className="flex gap-2"><button disabled={busy} className={btn}>Send request</button><button type="button" onClick={() => setAsking(false)} className={linkBtn}>Cancel</button></div>
          </form>
        ) : <button onClick={() => setAsking(true)} className={`${btnSoft} self-start`}>Ask to join</button>)
        : <p className="text-[14.5px] text-ink-3">{full ? "This team is full." : "Not looking for people right now."}</p>}
    </li>
  );
}
