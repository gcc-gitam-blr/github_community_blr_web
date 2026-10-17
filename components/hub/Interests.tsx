"use client";
import { useEffect, useState } from "react";
import { deleteInterests, myInterests, saveInterests, summary, type Summary } from "@/lib/hub/client";
import { DOMAINS, HOURS, LIMITS, domainLabel, parseSkills, skillsText } from "@/lib/projects";
import { AreaPicker, Notice, btn, field, linkBtn, type Say } from "./bits";

/* "What I'm into": the interest survey. Answers are private: the core team uses them to plan projects, and other members
   see only counts (and only where at least 3 people share one) plus whoever ticked "let teammates find me". */
export function Interests({ uid }: { uid: string }) {
  const [loaded, setLoaded] = useState(false); const [saved, setSaved] = useState(false);
  const [domains, setDomains] = useState<string[]>([]); const [skills, setSkills] = useState(""); const [wants, setWants] = useState("");
  const [hours, setHours] = useState<string>(""); const [found, setFound] = useState(false);
  const [sum, setSum] = useState<Summary | null>(null); const [say, setSay] = useState<Say>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([myInterests(uid), summary()]).then(([mine, s]) => {
      if (!live) return;
      if (mine) { setDomains(mine.domains); setSkills(skillsText(mine.skills)); setWants(mine.wants ?? ""); setHours(mine.hours ?? ""); setFound(mine.discoverable); setSaved(true); }
      setSum(s); setLoaded(true);
    });
    return () => { live = false; };
  }, [uid]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSay(null);
    const sk = parseSkills(skills);
    if (!domains.length) return setSay({ k: "err", t: "Pick at least one area you like." });
    if (!sk) return setSay({ k: "err", t: `Skills: up to ${LIMITS.skills}, separated by commas, each 2 to ${LIMITS.skillMax} characters (letters, numbers, + # . -).` });
    setBusy(true); const r = await saveInterests({ domains, skills: sk, wants: wants.trim() || null, hours: hours || null, discoverable: found }); setBusy(false);
    setSay(r.ok ? { k: "ok", t: "Saved. Thank you: this helps us choose projects the whole club can build." } : { k: "err", t: r.error });
    if (r.ok) { setSaved(true); setSum(await summary()); }
  };
  const remove = async () => {
    setBusy(true); const r = await deleteInterests(); setBusy(false);
    if (r.ok) { setDomains([]); setSkills(""); setWants(""); setHours(""); setFound(false); setSaved(false); setSay({ k: "ok", t: "Your answers are deleted." }); setSum(await summary()); }
    else setSay({ k: "err", t: r.error });
  };
  if (!loaded) return <div className="h-48" aria-busy="true" />;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <form onSubmit={save} noValidate className="space-y-6 rounded-[18px] border border-line bg-white p-6 sm:p-8">
        <div>
          <h2 className="text-[26px]">{saved ? "Your answers" : "Tell us what you'd like to build"}</h2>
          <p className="mt-2 text-[16px] text-ink-2">It takes a minute. We use it to pick projects people actually want, and to help you find teammates. You can change it any time.</p>
        </div>
        <AreaPicker value={domains} onChange={setDomains} max={LIMITS.domainsMember} legend="Which areas do you like?" />
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Your skills <span className="font-normal text-ink-3">(commas, up to {LIMITS.skills}; beginners welcome: &ldquo;html&rdquo; counts)</span></span><input className={field} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="react, python, figma" /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">What would you like to work on? <span className="font-normal text-ink-3">(optional)</span></span><textarea className={field} rows={3} value={wants} maxLength={LIMITS.wants} onChange={(e) => setWants(e.target.value)} placeholder="A tool for first-years, a game, something with AI…" /></label>
        <fieldset>
          <legend className="mb-2 text-[14px] font-medium">How much time could you give? <span className="font-normal text-ink-3">(optional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {HOURS.map((h) => <label key={h.id} className={`cursor-pointer rounded-full border-2 px-3.5 py-1.5 text-[14.5px] ${hours === h.id ? "border-ink bg-[#dafbe1] font-semibold" : "border-line hover:border-ink/50"}`}><input type="radio" name="hours" className="sr-only" checked={hours === h.id} onChange={() => setHours(h.id)} />{h.label}</label>)}
            {hours && <button type="button" onClick={() => setHours("")} className={linkBtn}>Clear</button>}
          </div>
        </fieldset>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={found} onChange={(e) => setFound(e.target.checked)} />
          <span><span className="block font-semibold">Let teammates find me</span><span className="block text-[14.5px] text-ink-2">Other members can see your name, GitHub username, areas and skills when they look for people. Off by default. The core team always sees your answers, to plan projects.</span></span>
        </label>
        <Notice say={say} />
        <div className="flex flex-wrap items-center gap-4">
          <button disabled={busy} className={btn}>{busy ? "Saving…" : saved ? "Save changes" : "Save my answers"}</button>
          {saved && <button type="button" disabled={busy} onClick={() => void remove()} className={linkBtn}>Delete my answers</button>}
        </div>
      </form>

      <aside aria-labelledby="club-into" className="space-y-4">
        <h2 id="club-into" className="text-[24px]">What the club is into</h2>
        {!sum || !sum.responses ? <p className="text-ink-2">Nobody has answered yet. Be the first.</p> : (<>
          <p className="text-ink-2">{sum.responses} {sum.responses === 1 ? "member has" : "members have"} answered.</p>
          <ul className="space-y-2">
            {(sum.domains ?? []).map((d) => (
              <li key={d.domain} className="flex items-center gap-3 text-[15.5px]"><span className="min-w-0 flex-1">{domainLabel(d.domain)}</span>
                <span className="font-mono text-[14px] text-ink-3">{d.count === null ? "fewer than 3" : d.count}</span></li>
            ))}
          </ul>
          {(sum.skills ?? []).length > 0 && <div><h3 className="text-[16px]">Skills we have</h3><ul className="mt-2 flex flex-wrap gap-1.5">{(sum.skills ?? []).map((k) => <li key={k.skill} className="rounded-full bg-soft px-2.5 py-0.5 font-mono text-[12.5px] text-ink-2">{k.skill} · {k.count}</li>)}</ul></div>}
          <p className="text-[13px] text-ink-3">To keep answers private, a number shows only where at least 3 people share it. {DOMAINS.length} areas to pick from.</p>
        </>)}
      </aside>
    </div>
  );
}
