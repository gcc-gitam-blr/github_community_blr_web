"use client";
import { tabKeys } from "@/components/ui/tabKeys";
import { useCallback, useEffect, useState } from "react";
import {
  createPolicy, discardPolicyDraft, policies as loadPolicies, publishPolicyVersion, savePolicyDraft, setPolicyOwner,
  type PolicyDraft, type PolicyRow, type PolicyVersion,
} from "@/lib/admin/client";
import { addDays, daysLeft, niceDate, todayIST } from "@/lib/admin/appointments";
import { Composer, State, btn, btnSoft, card, count, head, input } from "./kit";

/* The club's own rules, as versions. A draft is written by one admin and published by a different one; a published
   version is never edited, so the page only ever adds. Nothing is written for you: the club writes its policies. */
type Note = { k: "ok" | "err"; t: string } | null;
type Run = (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean>;
type Data = { list: PolicyRow[]; versions: PolicyVersion[]; drafts: PolicyDraft[]; names: Record<string, string> };

export function Policies({ admin, meId }: { admin: boolean; meId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [f, setF] = useState({ slug: "", title: "", owner: "" });
  const [note, setNote] = useState<Note>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setData(await loadPolicies()), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  const run: Run = async (p, done) => { setBusy(true); setNote(null); const r = await p; setBusy(false); setNote({ k: r.ok ? "ok" : "err", t: r.ok ? done : (r as { error: string }).error }); if (r.ok) await load(); return r.ok; };
  const slugFrom = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}
      <p className="text-[14.5px] text-ink-2">Policies are written and approved by two different admins, and a published version is never changed: a change is a new version, and the old ones stay. They are internal; to make one public, publish it deliberately on the site. <b className="text-ink">Nothing is pre-filled: the club writes its own.</b></p>
      {admin && (
        <Composer id="pol-h" title="New policy">
          <form onSubmit={(e) => { e.preventDefault(); void run(createPolicy(f.slug || slugFrom(f.title), f.title, f.owner), "Created. Write its first draft below.").then((ok) => ok && setF({ slug: "", title: "", owner: "" })); }} className="grid gap-3 sm:grid-cols-2">
            <label className="text-[14px] font-semibold">Title<input className={`${input} mt-1 font-normal`} value={f.title} maxLength={120} placeholder="Code of conduct" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
            <label className="text-[14px] font-semibold">Owner <span className="font-normal text-ink-3">(GitHub username, optional)</span><input className={`${input} mt-1 font-normal`} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} autoComplete="off" /></label>
            <label className="text-[14px] font-semibold sm:col-span-2">Short name <span className="font-normal text-ink-3">(lower-case words with dashes; made from the title if left empty)</span><input className={`${input} mt-1 font-normal`} value={f.slug} maxLength={60} placeholder={slugFrom(f.title) || "code-of-conduct"} onChange={(e) => setF({ ...f, slug: e.target.value })} /></label>
            <div className="sm:col-span-2"><button disabled={busy || f.title.trim().length < 3} className={btn}>Create policy</button></div>
          </form>
        </Composer>
      )}
      <section className={card} aria-labelledby="pols-h">
        <div className={head}><h2 id="pols-h" className="text-[18px]">Policies</h2><span className={count}>{data?.list.length ?? 0}</span></div>
        {data === null ? <p className="p-5 text-ink-3">Loading…</p> : data.list.length === 0 ? <p className="p-5 text-ink-3">{admin ? "No policies yet. Create the first one above." : "No policies have been published yet."}</p> : (
          <ul className="divide-y divide-line">
            {data.list.map((p) => <PolicyItem key={p.id} p={p} data={data} admin={admin} meId={meId} busy={busy} run={run} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function PolicyItem({ p, data, admin, meId, busy, run }: { p: PolicyRow; data: Data; admin: boolean; meId: string; busy: boolean; run: Run }) {
  const versions = data.versions.filter((v) => v.policy_id === p.id), latest = versions[0], draft = data.drafts.find((d) => d.policy_id === p.id);
  const [body, setBody] = useState(draft?.body_md ?? latest?.body_md ?? ""); const [eff, setEff] = useState(addDays(todayIST(), 1)); const [rev, setRev] = useState(addDays(todayIST(), 366));
  const [owner, setOwner] = useState(""); const [shown, setShown] = useState<number | null>(latest?.version ?? null);
  const who = (id: string | null) => (id && data.names[id]) || "Someone";
  const due = latest ? daysLeft(latest.review_due_on) : null;
  const mineDraft = draft?.author_id === meId;
  const v = versions.find((x) => x.version === shown);
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-3 text-[14.5px] hover:bg-soft/60">
          <b>{p.title}</b>
          <State tone={latest ? "live" : "draft"}>{latest ? `Version ${latest.version}` : "No published version"}</State>
          {draft && <span className="text-[13.5px] text-[#9a6700]">{mineDraft ? "Your draft is waiting for another admin" : "A draft is waiting for approval"}</span>}
          {due !== null && due < 0 && <span className="text-[13.5px] font-semibold text-[#a40e26]">Review overdue by {-due} {-due === 1 ? "day" : "days"}</span>}
          <span className="ml-auto text-[13px] text-ink-3 group-open:hidden">Open</span>
        </summary>
        <div className="space-y-4 px-5 pb-5 text-[14.5px]">
          <p className="text-ink-3">Owner: {who(p.owner_id)}{p.owner_id ? "" : " (nobody yet)"}{latest ? ` · version ${latest.version} in effect from ${niceDate(latest.effective_on)}, review by ${niceDate(latest.review_due_on)}` : ""}</p>

          {versions.length > 0 && (
            <div>
              <div role="tablist" onKeyDown={tabKeys} aria-label="Versions" className="flex flex-wrap gap-1">
                {versions.map((x) => <button key={x.id} role="tab" aria-selected={shown === x.version} tabIndex={(shown === x.version) ? 0 : -1} onClick={() => setShown(x.version)} className={`rounded-md px-3 py-1.5 text-[14px] ${shown === x.version ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>Version {x.version}</button>)}
              </div>
              {v && <>
                <p className="mt-2 text-[13.5px] text-ink-3">Written by {who(v.author_id)}, approved by {who(v.approved_by)} on {niceDate(v.approved_on)} · in effect from {niceDate(v.effective_on)} · review by {niceDate(v.review_due_on)}</p>
                <div className="mt-2 max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-[#f6f8fa] p-4 text-[14.5px] text-ink-2" tabIndex={0} aria-label={`Text of ${p.title}, version ${v.version}`}>{v.body_md}</div>
              </>}
            </div>
          )}

          {admin && (
            <div className="rounded-lg border border-line p-4">
              <h4 className="text-[15px]">{draft ? "Draft of the next version" : latest ? "Write the next version" : "Write the first version"}</h4>
              {draft && <p className="mt-1 text-[13.5px] text-ink-3">Last edited by {who(draft.author_id)}. {mineDraft ? "You wrote it, so another admin has to approve and publish it." : "You can approve and publish it, or edit it (then you become its author)."}</p>}
              <form onSubmit={(e) => { e.preventDefault(); void run(savePolicyDraft(p.id, body), "Draft saved."); }} className="mt-2 space-y-2">
                <label className="sr-only" htmlFor={`b-${p.id}`}>Text of the policy</label>
                <textarea id={`b-${p.id}`} rows={10} maxLength={50000} value={body} onChange={(e) => setBody(e.target.value)} className={`${input} font-mono text-[14px]`} />
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy || body.trim().length < 10} className={btnSoft}>Save draft</button>
                  {draft && <button type="button" disabled={busy} onClick={() => void run(discardPolicyDraft(p.id), "Draft thrown away.")} className={btnSoft}>Throw away the draft</button>}
                </div>
              </form>
              {draft && !mineDraft && (
                <form onSubmit={(e) => { e.preventDefault(); void run(publishPolicyVersion(p.id, eff, rev), "Published. It is now final.").then((ok) => ok && setShown(null)); }} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
                  <label className="text-[13.5px] font-semibold">In effect from<input type="date" min={todayIST()} value={eff} onChange={(e) => setEff(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
                  <label className="text-[13.5px] font-semibold">Review by<input type="date" min={eff} value={rev} onChange={(e) => setRev(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
                  <div className="sm:col-span-2"><button disabled={busy} className={btn}>Approve and publish as version {(latest?.version ?? 0) + 1}</button><span className="ml-3 text-[13px] text-ink-3">Once published it can&apos;t be edited.</span></div>
                </form>
              )}
              <form onSubmit={(e) => { e.preventDefault(); void run(setPolicyOwner(p.id, owner), "Owner changed.").then((ok) => ok && setOwner("")); }} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
                <label className="text-[13.5px] font-semibold">Change owner<input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="github-username" className={`${input} mt-1 font-normal`} autoComplete="off" /></label>
                <button disabled={busy || !owner.trim()} className={btnSoft}>Change</button>
              </form>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
