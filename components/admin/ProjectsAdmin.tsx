"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  allInterests, decidePublishing, ideas as loadIdeas, postIdea, setIdeaStatus, setProjectOwner, summary, unpublishProject,
  type Idea, type Interests, type JoinRequest, type Summary, type TeamMember,
} from "@/lib/hub/client";
import { HOURS, IDEA_STATUS, domainLabel, type IdeaStatus } from "@/lib/projects";
import { IdeaForm } from "@/components/hub/bits";

/* Admin → Projects (core team and admins): what the members said they like, club projects built from that, the queue of
   projects asking to be featured on the website, and every project. The database enforces who may do what. */
const card = "rounded-[12px] border border-line bg-white";
const btn = "inline-flex items-center justify-center rounded-md bg-ink px-4 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50";
const btnSoft = "inline-flex items-center justify-center rounded-md border border-line bg-white px-3 py-2 text-[14px] font-semibold transition hover:bg-soft disabled:opacity-50";
const input = "w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px]";
type Note = { k: "ok" | "err"; t: string } | null;
type Run = (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean>;
type Answer = Interests & { user_id: string; handle: string; name: string };
type Data = { ideas: Idea[]; team: TeamMember[]; requests: JoinRequest[]; names: Record<string, { handle: string; name: string }> };

export function ProjectsAdmin({ admin, meId }: { admin: boolean; meId: string }) {
  const [view, setView] = useState<"survey" | "review" | "all">("survey");
  const [sum, setSum] = useState<Summary | null>(null); const [answers, setAnswers] = useState<Answer[] | null>(null); const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState<Note>(null); const [busy, setBusy] = useState(false); const [area, setArea] = useState<string>("web"); const [club, setClub] = useState(false);
  const load = useCallback(async () => { const [s, a, d] = await Promise.all([summary(), allInterests(), loadIdeas()]); setSum(s); setAnswers(a); setData(d); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  const run: Run = async (p, done) => { setBusy(true); setNote(null); const r = await p; setBusy(false); setNote({ k: r.ok ? "ok" : "err", t: r.ok ? done : (r as { error: string }).error }); if (r.ok) await load(); return r.ok; };
  const queue = (data?.ideas ?? []).filter((i) => i.publish_state === "requested");

  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}
      <div role="tablist" aria-label="Projects" className="flex flex-wrap gap-1">
        {([["survey", "What members like"], ["review", `To feature${queue.length ? ` (${queue.length})` : ""}`], ["all", "All projects"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-[14.5px] ${view === v ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{label}</button>
        ))}
      </div>

      {view === "survey" && (<>
        <section className={`${card} p-5`} aria-labelledby="sv-h">
          <h2 id="sv-h" className="text-[18px]">What members like</h2>
          {!sum?.allowed ? <p className="mt-2 text-ink-3">Loading…</p> : (<>
            <p className="mt-1 text-[14.5px] text-ink-2">{sum.responses} of {sum.members ?? "?"} active members have answered. Members tell us here which areas they like and what they&apos;d build: use it to pick a club project everyone can join.</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {(sum.domains ?? []).map((d) => (
                <li key={d.domain}><button onClick={() => setArea(d.domain)} aria-pressed={area === d.domain} className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-[14.5px] ${area === d.domain ? "border-ink bg-soft" : "border-line hover:bg-soft/60"}`}><span className="flex-1">{domainLabel(d.domain)}</span><span className="font-mono text-ink-3">{d.count}</span></button></li>
              ))}
            </ul>
            {(sum.skills ?? []).length > 0 && <p className="mt-4 text-[14px] text-ink-3">Most common skills: <span className="font-mono text-ink-2">{(sum.skills ?? []).map((k) => `${k.skill} ${k.count}`).join(" · ")}</span></p>}
          </>)}
        </section>
        <section className={card} aria-labelledby="who-h">
          <h2 id="who-h" className="border-b border-line px-5 py-3 text-[18px]">Who likes {domainLabel(area)} <span className="ml-1 rounded-full bg-soft px-2 py-0.5 text-[12px] font-normal text-ink-3">{(answers ?? []).filter((a) => a.domains.includes(area)).length}</span></h2>
          {answers === null ? <p className="p-5 text-ink-3">Loading…</p> : (() => { const rows = answers.filter((a) => a.domains.includes(area)); return rows.length === 0 ? <p className="p-5 text-ink-3">Nobody has picked this area yet.</p> : (
            <ul className="divide-y divide-line">
              {rows.map((a) => (
                <li key={a.user_id} className="px-5 py-3 text-[14.5px]">
                  <b>{a.name}</b> <a href={`https://github.com/${a.handle}`} target="_blank" rel="noopener" className="text-ink-3 hover:underline">@{a.handle}</a>
                  <span className="ml-2 text-[13px] text-ink-3">{a.discoverable ? "can be found by teammates" : "private to the core team"}{a.hours ? ` · ${HOURS.find((h) => h.id === a.hours)?.label}` : ""}</span>
                  {a.skills.length > 0 && <span className="block font-mono text-[13px] text-ink-2">{a.skills.join(", ")}</span>}
                  {a.wants && <span className="block text-ink-2">&ldquo;{a.wants}&rdquo;</span>}
                </li>
              ))}
            </ul>); })()}
          <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">These answers are for planning projects. Don&apos;t share them outside the core team.</p>
        </section>
        <section className={`${card} p-5`} aria-labelledby="club-h">
          <div className="flex flex-wrap items-center gap-3"><h2 id="club-h" className="text-[18px]">Start a club project</h2><button onClick={() => setClub(!club)} aria-expanded={club} className={btnSoft}>{club ? "Close" : "Post one"}</button></div>
          <p className="mt-1 text-[14.5px] text-ink-2">A project the whole club can join, chosen from what members said. Leave &ldquo;people needed&rdquo; empty to keep it open to everyone.</p>
          {club && <div className="mt-4"><IdeaForm club busy={busy} submit={async (f) => { const ok = await run(postIdea(f, true), "Posted. Members can now ask to join it in the project hub."); if (ok) setClub(false); return ok; }} cancel={() => setClub(false)} /></div>}
        </section>
      </>)}

      {view === "review" && (
        <section className={card} aria-labelledby="rv-h">
          <h2 id="rv-h" className="border-b border-line px-5 py-3 text-[18px]">Asking to be featured on the website</h2>
          <p className="px-5 pt-3 text-[14.5px] text-ink-2">Only the title, summary, areas, repository link and the GitHub names of members who agreed are shown publicly. You can&apos;t review your own project.</p>
          {data === null ? <p className="p-5 text-ink-3">Loading…</p> : queue.length === 0 ? <p className="p-5 text-ink-3">Nothing is waiting.</p> : (
            <ul className="divide-y divide-line">
              {queue.map((i) => <Review key={i.id} i={i} data={data} meId={meId} busy={busy} run={run} />)}
            </ul>
          )}
        </section>
      )}

      {view === "all" && <AllProjects data={data} admin={admin} busy={busy} run={run} />}
    </div>
  );
}

function Review({ i, data, meId, busy, run }: { i: Idea; data: Data; meId: string; busy: boolean; run: Run }) {
  const [why, setWhy] = useState("");
  const isOwner = data.team.some((t) => t.project_id === i.id && t.user_id === meId && t.role === "owner");
  const shown = data.team.filter((t) => t.project_id === i.id && t.shows_publicly).map((t) => data.names[t.user_id]?.handle).filter(Boolean);
  return (
    <li className="space-y-2 px-5 py-4 text-[14.5px]">
      <p><b>{i.title}</b> <span className="text-ink-3">{IDEA_STATUS[i.status]} · {i.domains.map(domainLabel).join(", ")}</span></p>
      <p className="whitespace-pre-wrap text-ink-2">{i.summary}</p>
      <p className="text-[13.5px] text-ink-3">Repository: {i.repo_url ? <a href={i.repo_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{i.repo_url.replace("https://github.com/", "")}</a> : "none"} · names shown: {shown.length ? shown.map((h) => `@${h}`).join(", ") : "none (only the number of people)"}</p>
      {isOwner ? <p className="text-ink-3">This is your own project, so someone else on the core team has to review it.</p> : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 text-[13.5px] font-semibold">Note <span className="font-normal text-ink-3">(required if you send it back)</span><input className={`${input} mt-1 font-normal`} value={why} maxLength={300} onChange={(e) => setWhy(e.target.value)} /></label>
          <button disabled={busy} onClick={() => void run(decidePublishing(i.id, true, why), "Featured on the website.")} className={btn}>Feature it</button>
          <button disabled={busy || why.trim().length < 3} onClick={() => void run(decidePublishing(i.id, false, why), "Sent back with your note.")} className={btnSoft}>Send back</button>
        </div>
      )}
    </li>
  );
}

function AllProjects({ data, admin, busy, run }: { data: Data | null; admin: boolean; busy: boolean; run: Run }) {
  const [st, setSt] = useState<IdeaStatus>("building"); const [owner, setOwner] = useState<Record<number, string>>({});
  const counts = useMemo(() => Object.fromEntries((Object.keys(IDEA_STATUS) as IdeaStatus[]).map((s) => [s, (data?.ideas ?? []).filter((i) => i.status === s).length])) as Record<IdeaStatus, number>, [data]);
  const rows = (data?.ideas ?? []).filter((i) => i.status === st);
  return (
    <section className={card} aria-labelledby="all-h">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <h2 id="all-h" className="mr-2 text-[18px]">All projects</h2>
        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1">
          {(Object.keys(IDEA_STATUS) as IdeaStatus[]).map((s) => <button key={s} role="tab" aria-selected={st === s} onClick={() => setSt(s)} className={`rounded-md px-3 py-1.5 text-[14px] ${st === s ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{IDEA_STATUS[s]} <span className={st === s ? "text-white/70" : "text-ink-3"}>{counts[s]}</span></button>)}
        </div>
      </div>
      {data === null ? <p className="p-5 text-ink-3">Loading…</p> : rows.length === 0 ? <p className="p-5 text-ink-3">Nothing here.</p> : (
        <ul className="divide-y divide-line">
          {rows.map((i) => {
            const team = data.team.filter((t) => t.project_id === i.id), o = data.names[i.owner_id ?? ""];
            return (
              <li key={i.id} className="space-y-1 px-5 py-3 text-[14.5px]">
                <p><b>{i.title}</b> <span className="text-ink-3">{i.origin === "club" ? "club project · " : ""}{team.length}{i.team_size ? ` of ${i.team_size}` : ""} on the team · owner {o ? `@${o.handle}` : "none"}{i.publish_state !== "private" ? ` · ${i.publish_state === "published" ? "on the website" : "asked to be featured"}` : ""}</span></p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {i.publish_state === "published" && <button disabled={busy} onClick={() => void run(unpublishProject(i.id), "Taken off the website.")} className={btnSoft}>Take off the website</button>}
                  {admin && i.status === "archived" && <button disabled={busy} onClick={() => void run(setIdeaStatus(i.id, "idea"), "Brought back as an idea.")} className={btnSoft}>Bring back</button>}
                  {admin && i.status !== "archived" && <button disabled={busy} onClick={() => void run(setIdeaStatus(i.id, "archived"), "Archived.")} className={btnSoft}>Archive</button>}
                  {admin && team.length > 1 && (
                    <form onSubmit={(e) => { e.preventDefault(); void run(setProjectOwner(i.id, owner[i.id] ?? ""), "New owner set."); }} className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`o-${i.id}`}>New owner (the GitHub username of someone on the team)</label>
                      <input id={`o-${i.id}`} className={`${input} !w-[190px]`} placeholder="hand over to @…" value={owner[i.id] ?? ""} onChange={(e) => setOwner({ ...owner, [i.id]: e.target.value })} autoComplete="off" />
                      <button disabled={busy || !(owner[i.id] ?? "").trim()} className={btnSoft}>Hand over</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

