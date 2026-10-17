"use client";
import { useState } from "react";
import { findTeammates, type Teammate } from "@/lib/hub/client";
import { DOMAINS, HOURS, domainLabel } from "@/lib/projects";
import { Tags, btn, field } from "./bits";

/* Find people by area or skill. You only ever see members who ticked "let teammates find me". */
export function FindPeople() {
  const [area, setArea] = useState(""); const [skill, setSkill] = useState("");
  const [rows, setRows] = useState<Teammate[] | null>(null); const [busy, setBusy] = useState(false);
  const search = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setRows(await findTeammates(area || null, skill.trim() || null)); setBusy(false); };
  return (
    <div className="space-y-6">
      <form onSubmit={search} className="flex flex-wrap items-end gap-3 rounded-[18px] border border-line bg-white p-5">
        <label className="text-[14px] font-medium">Area<select className={`${field} mt-1.5 !w-auto min-w-[200px]`} value={area} onChange={(e) => setArea(e.target.value)}><option value="">Any area</option>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
        <label className="min-w-[200px] flex-1 text-[14px] font-medium">A skill<input className={`${field} mt-1.5`} value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="react, figma, python…" /></label>
        <button disabled={busy} className={btn}>{busy ? "Looking…" : "Find people"}</button>
      </form>
      {rows === null ? <p className="text-ink-2">Pick an area or a skill, or press Find people to see everyone who is open to teaming up.</p>
        : rows.length === 0 ? <p className="rounded-xl border border-line bg-white p-6 text-ink-2">Nobody matches yet. People only show up here if they ticked <b>Let teammates find me</b> in their answers, so it fills up as more members opt in.</p> : (
          <ul className="grid gap-4 md:grid-cols-2">
            {rows.map((p) => (
              <li key={p.handle} className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-white p-5">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://github.com/${p.handle}.png?size=96`} alt="" width={44} height={44} className="h-11 w-11 rounded-full border border-line bg-soft" />
                  <div className="min-w-0"><p className="truncate font-semibold">{p.name}</p><a href={`https://github.com/${p.handle}`} target="_blank" rel="noopener" className="font-mono text-[13.5px] text-ink-3 hover:underline">@{p.handle}</a></div>
                </div>
                <Tags items={p.domains} label={domainLabel} />
                {p.skills.length > 0 && <p className="text-[14px] text-ink-3">Skills: <span className="font-mono text-ink-2">{p.skills.join(", ")}</span></p>}
                {p.wants && <p className="text-[15px] text-ink-2">&ldquo;{p.wants}&rdquo;</p>}
                {p.hours && <p className="text-[13.5px] text-ink-3">{HOURS.find((h) => h.id === p.hours)?.label}</p>}
              </li>
            ))}
          </ul>
        )}
      <p className="text-[13px] text-ink-3">Reach out through GitHub or the club WhatsApp group. Be kind: people can say no.</p>
    </div>
  );
}
