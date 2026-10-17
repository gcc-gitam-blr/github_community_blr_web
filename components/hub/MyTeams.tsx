"use client";
import { useState } from "react";
import {
  decideRequest, leaveProject, removeProjectMember, requestPublishing, setIdeaStatus, setPublicCredit, unpublishProject, updateIdea,
  type Idea, type JoinRequest, type TeamMember,
} from "@/lib/hub/client";
import { IDEA_STATUS, domainLabel, type IdeaStatus } from "@/lib/projects";
import { IdeaForm, Notice, Tags, btn, btnSoft, linkBtn, type Say } from "./bits";

/* My teams: the projects you are on. Owners answer requests, move the project along, edit it and ask for it to be
   featured on the website; everyone chooses whether their GitHub name is shown there. */
type Names = Record<string, { handle: string; name: string }>;
const NEXT: Record<IdeaStatus, { to: IdeaStatus; label: string }[]> = {
  idea: [{ to: "forming", label: "We're forming a team" }, { to: "building", label: "We're building it" }],
  forming: [{ to: "building", label: "We're building it" }, { to: "idea", label: "Back to an idea" }],
  building: [{ to: "shipped", label: "We shipped it" }, { to: "forming", label: "Back to forming" }],
  shipped: [{ to: "building", label: "Keep building" }],
  archived: [],
};

export function MyTeams({ uid, data, names, reload }: { uid: string; data: { ideas: Idea[]; team: TeamMember[]; requests: JoinRequest[] }; names: Names; reload: () => Promise<void> }) {
  const [say, setSay] = useState<Say>(null); const [busy, setBusy] = useState(false);
  const mine = data.ideas.filter((i) => data.team.some((t) => t.project_id === i.id && t.user_id === uid) && i.status !== "archived");
  const run = async (p: Promise<{ ok: boolean; error?: string }>, done: string) => { setBusy(true); setSay(null); const r = await p; setBusy(false); setSay(r.ok ? { k: "ok", t: done } : { k: "err", t: (r as { error: string }).error }); if (r.ok) await reload(); return r.ok; };
  const asked = data.requests.filter((r) => r.user_id === uid && r.status === "pending");
  if (!mine.length) return <p className="rounded-xl border border-line bg-white p-6 text-ink-2">You aren&apos;t on a project team yet. Ask to join one under <b>Project ideas</b>, or share your own idea.{asked.length > 0 && ` You have ${asked.length} request${asked.length === 1 ? "" : "s"} waiting for an answer.`}</p>;
  return (
    <div className="space-y-5">
      <Notice say={say} />
      <ul className="space-y-5">
        {mine.map((i) => <Team key={i.id} i={i} uid={uid} members={data.team.filter((t) => t.project_id === i.id)} pending={data.requests.filter((r) => r.project_id === i.id && r.status === "pending")} names={names} busy={busy} run={run} />)}
      </ul>
    </div>
  );
}

function Team({ i, uid, members, pending, names, busy, run }: { i: Idea; uid: string; members: TeamMember[]; pending: JoinRequest[]; names: Names; busy: boolean; run: (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean> }) {
  const owner = i.owner_id === uid, me = members.find((m) => m.user_id === uid);
  const [editing, setEditing] = useState(false);
  return (
    <li className="space-y-4 rounded-[18px] border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[22px]">{i.title}</h3>
        <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[12.5px]">{IDEA_STATUS[i.status]}</span>
        {i.publish_state === "published" && <span className="rounded-full bg-[#dafbe1] px-2.5 py-0.5 text-[12.5px] font-semibold text-[#116329]">On the website</span>}
        {i.publish_state === "requested" && <span className="rounded-full bg-[#fff8c5] px-2.5 py-0.5 text-[12.5px] font-semibold text-[#4d2d00]">Waiting for the core team to review</span>}
      </div>
      {editing ? <IdeaForm initial={i} busy={busy} cancel={() => setEditing(false)} submit={async (f) => { const ok = await run(updateIdea(i.id, f), i.publish_state === "published" ? "Saved. Because it is on the website, the core team will look at it again before it shows." : "Saved."); if (ok) setEditing(false); return ok; }} /> : (<>
        <p className="text-[15.5px] text-ink-2">{i.summary}</p>
        <Tags items={i.domains} label={domainLabel} />
        {i.publish_note && i.publish_state === "private" && <p className="rounded-md bg-soft px-3 py-2 text-[14.5px] text-ink-2"><b>From the core team:</b> {i.publish_note}</p>}
      </>)}

      <div>
        <h4 className="text-[16px]">The team <span className="font-normal text-ink-3">({members.length}{i.team_size ? ` of ${i.team_size}` : ""})</span></h4>
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
          {members.map((m) => { const n = names[m.user_id]; return (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-3.5 py-2 text-[15px]">
              <span className="min-w-0 flex-1">{n ? <><b>{n.name}</b> <a href={`https://github.com/${n.handle}`} target="_blank" rel="noopener" className="font-mono text-[13.5px] text-ink-3 hover:underline">@{n.handle}</a></> : "A member"}{m.role === "owner" && <span className="ml-2 text-[12.5px] text-ink-3">owner</span>}{m.user_id === uid && <span className="ml-2 text-[12.5px] text-ink-3">you</span>}</span>
              {owner && m.role !== "owner" && <button disabled={busy} onClick={() => void run(removeProjectMember(i.id, m.user_id), "Removed from the team.")} className={linkBtn} aria-label={`Remove ${n?.name ?? "this member"} from the team`}>Remove</button>}
            </li>
          ); })}
        </ul>
      </div>

      {owner && pending.length > 0 && (
        <div>
          <h4 className="text-[16px]">People who want to join</h4>
          <ul className="mt-2 space-y-2">
            {pending.map((r) => { const n = names[r.user_id]; return (
              <li key={r.id} className="rounded-lg border border-line p-3.5">
                <p className="text-[15px]">{n ? <><b>{n.name}</b> <a href={`https://github.com/${n.handle}`} target="_blank" rel="noopener" className="font-mono text-[13.5px] text-ink-3 hover:underline">@{n.handle}</a></> : "A member"}</p>
                {r.message && <p className="mt-1 text-[15px] text-ink-2">&ldquo;{r.message}&rdquo;</p>}
                <div className="mt-2 flex gap-2"><button disabled={busy} onClick={() => void run(decideRequest(r.id, true), "Added to the team.")} className={btn}>Accept</button><button disabled={busy} onClick={() => void run(decideRequest(r.id, false), "Declined.")} className={btnSoft}>Decline</button></div>
              </li>
            ); })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-[14.5px]">
        {owner && !editing && <button disabled={busy} onClick={() => setEditing(true)} className={linkBtn}>Edit the project</button>}
        {owner && NEXT[i.status].map((n) => <button key={n.to} disabled={busy} onClick={() => void run(setIdeaStatus(i.id, n.to), `Now: ${IDEA_STATUS[n.to].toLowerCase()}.`)} className={linkBtn}>{n.label}</button>)}
        {owner && (i.status === "building" || i.status === "shipped") && i.publish_state === "private" && <button disabled={busy} onClick={() => void run(requestPublishing(i.id), "Sent to the core team. They'll review it before it shows on the website.")} className={btnSoft}>Ask to feature on the website</button>}
        {owner && i.publish_state !== "private" && <button disabled={busy} onClick={() => void run(unpublishProject(i.id), i.publish_state === "published" ? "Taken off the website." : "Request cancelled.")} className={linkBtn}>{i.publish_state === "published" ? "Take it off the website" : "Cancel the request"}</button>}
        {owner && <button disabled={busy} onClick={() => void run(setIdeaStatus(i.id, "archived"), "Archived.")} className={linkBtn}>Archive</button>}
        {!owner && <button disabled={busy} onClick={() => void run(leaveProject(i.id), "You left the team.")} className={linkBtn}>Leave the team</button>}
      </div>
      {me && (
        <label className="flex cursor-pointer items-start gap-3 text-[14.5px]">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={me.shows_publicly} disabled={busy} onChange={(e) => void run(setPublicCredit(i.id, e.target.checked), e.target.checked ? "Your GitHub name will show on the website once it is featured." : "Your name is hidden on the website.")} />
          <span>Show my GitHub name on the website when this project is featured <span className="text-ink-3">(otherwise only the number of people shows)</span></span>
        </label>
      )}
    </li>
  );
}
