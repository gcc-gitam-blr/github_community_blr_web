"use client";
import { useEffect, useState } from "react";
import { findTeammates, myInterests, type Interests, type Teammate } from "@/lib/hub/client";
import { DOMAINS, HOURS, domainLabel } from "@/lib/projects";
import { Tags, btn, field } from "./bits";

/* Find people by area or skill. Members find only people who ticked "let teammates find me"; the core team and admins
   find everyone who answered, with the ones members can't see marked. Your own card sits on top, so you can check
   exactly how others see you (and whether they can). */
type Person = Pick<Teammate, "handle" | "name" | "domains" | "skills" | "wants" | "hours">;

function Card({ p, mark }: { p: Person; mark?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-white p-5">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://github.com/${p.handle}.png?size=96`} alt="" width={44} height={44} className="h-11 w-11 rounded-full border border-line bg-soft" />
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.name}</p><a href={`https://github.com/${p.handle}`} target="_blank" rel="noopener" className="font-mono text-[13.5px] text-ink-3 hover:underline">@{p.handle}</a></div>
        {mark}
      </div>
      <Tags items={p.domains} label={domainLabel} />
      {p.skills.length > 0 && <p className="text-[14px] text-ink-3">Skills: <span className="font-mono text-ink-2">{p.skills.join(", ")}</span></p>}
      {p.wants && <p className="text-[15px] text-ink-2">&ldquo;{p.wants}&rdquo;</p>}
      {p.hours && <p className="text-[13.5px] text-ink-3">{HOURS.find((h) => h.id === p.hours)?.label}</p>}
    </li>
  );
}
const pill = "flex-none rounded-full border px-2.5 py-0.5 text-[12px] font-semibold";

export function FindPeople({ me, staff, onEdit }: { me: { id: string; handle: string; name: string }; staff: boolean; onEdit: () => void }) {
  const [area, setArea] = useState(""); const [skill, setSkill] = useState("");
  const [rows, setRows] = useState<Teammate[] | null>(null); const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Interests | null | undefined>(undefined);
  useEffect(() => { let on = true; void myInterests(me.id).then((m) => on && setMine(m)); return () => { on = false; }; }, [me.id]);
  const search = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setRows(await findTeammates(area || null, skill.trim() || null)); setBusy(false); };
  const hidden = rows?.filter((r) => !r.listed).length ?? 0;
  return (
    <div className="space-y-6">
      {mine !== undefined && (
        <section aria-labelledby="you-h">
          <h2 id="you-h" className="mb-3 text-[18px]">How others see you</h2>
          {mine === null ? (
            <p className="rounded-xl border border-dashed border-line bg-white p-5 text-ink-2">You haven&apos;t said what you&apos;re into yet, so nobody can find you. <button onClick={onEdit} className="font-semibold text-link underline-offset-2 hover:underline">Fill it in</button>: it takes a minute.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              <Card p={{ handle: me.handle, name: me.name, ...mine }} mark={mine.discoverable
                ? <span className={`${pill} border-[#4ac26b66] bg-[#dafbe1] text-[#116329]`}>Members can find you</span>
                : <span className={`${pill} border-line bg-soft text-ink-2`}>Only the core team sees this</span>} />
              {!mine.discoverable && <li className="self-center text-[14.5px] text-ink-2">Members can&apos;t find you yet. To be found by teammates, tick <b>Let teammates find me</b> in <button onClick={onEdit} className="font-semibold text-link underline-offset-2 hover:underline">What I&apos;m into</button> and save.</li>}
            </ul>
          )}
        </section>
      )}
      <form onSubmit={search} className="flex flex-wrap items-end gap-3 rounded-[18px] border border-line bg-white p-5">
        <label className="text-[14px] font-medium">Area<select className={`${field} mt-1.5 block !w-auto min-w-[200px]`} value={area} onChange={(e) => setArea(e.target.value)}><option value="">Any area</option>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
        <label className="min-w-[200px] flex-1 text-[14px] font-medium">A skill<input className={`${field} mt-1.5`} value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="react, figma, python…" /></label>
        <button disabled={busy} className={btn}>{busy ? "Looking…" : "Find people"}</button>
      </form>
      {staff && <p className="text-[14px] text-ink-3">You&apos;re on the core team, so you see everyone who answered. People marked <b>Hidden from members</b> didn&apos;t tick &ldquo;let teammates find me&rdquo;: members won&apos;t see them here.</p>}
      {rows === null ? <p className="text-ink-2">Pick an area or a skill, or press Find people to see everyone {staff ? "who answered" : "who is open to teaming up"}.</p>
        : rows.length === 0 ? <p className="rounded-xl border border-line bg-white p-6 text-ink-2">Nobody matches yet. People only show up here if they ticked <b>Let teammates find me</b> in their answers, so it fills up as more members opt in.</p> : (
          <>
            {staff && hidden > 0 && <p className="text-[14px] text-ink-2">{rows.length - hidden} of {rows.length} can be found by members.</p>}
            <ul className="grid gap-4 md:grid-cols-2">
              {rows.map((p) => <Card key={p.handle} p={p} mark={staff && !p.listed ? <span className={`${pill} border-line bg-soft text-ink-2`}>Hidden from members</span> : undefined} />)}
            </ul>
          </>
        )}
      <p className="text-[13px] text-ink-3">Reach out through GitHub or the club WhatsApp group. Be kind: people can say no.</p>
    </div>
  );
}
