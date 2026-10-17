"use client";
import { useState } from "react";
import { DOMAINS, LIMITS, REPO_RE, domainLabel, parseSkills, skillsText } from "@/lib/projects";
import type { Idea, IdeaFields } from "@/lib/hub/client";

/* Small pieces the project hub (members) and Admin → Projects (core team) share. Flat, like the rest of the site. */
export const field = "w-full rounded-lg border border-line bg-white px-4 py-3 text-[16px] outline-none transition focus:border-ink";
export const btn = "inline-flex items-center justify-center rounded-md bg-ink px-5 py-3 font-display font-bold text-white transition hover:bg-ink/85 disabled:opacity-60";
export const btnSoft = "inline-flex items-center justify-center rounded-md border-2 border-ink px-4 py-2.5 font-display text-[15px] font-bold transition hover:bg-ink hover:text-white disabled:opacity-60";
export const linkBtn = "text-[14.5px] text-ink-2 underline underline-offset-4 hover:text-ink disabled:opacity-60";
export type Say = { k: "ok" | "err"; t: string } | null;

export function Notice({ say }: { say: Say }) {
  if (!say) return null;
  return <p role={say.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${say.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{say.t}</p>;
}

/** The areas as tick boxes, with a limit. Calls onChange with the new list. */
export function AreaPicker({ value, onChange, max, legend }: { value: string[]; onChange: (v: string[]) => void; max: number; legend: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[14px] font-medium">{legend} <span className="font-normal text-ink-3">(up to {max})</span></legend>
      <div className="flex flex-wrap gap-2">
        {DOMAINS.map((d) => {
          const on = value.includes(d.id), full = !on && value.length >= max;
          return (
            <label key={d.id} className={`cursor-pointer rounded-full border-2 px-3.5 py-1.5 text-[14.5px] transition ${on ? "border-ink bg-[#dafbe1] font-semibold" : full ? "border-line text-ink-3 opacity-60" : "border-line hover:border-ink/50"}`}>
              <input type="checkbox" className="sr-only" checked={on} disabled={full} onChange={() => onChange(on ? value.filter((x) => x !== d.id) : [...value, d.id])} />{d.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export const Tags = ({ items, label }: { items: string[]; label?: (s: string) => string }) => (
  <ul className="flex flex-wrap gap-1.5">{items.map((t) => <li key={t} className="rounded-full bg-soft px-2.5 py-0.5 font-mono text-[12.5px] text-ink-2">{label ? label(t) : t}</li>)}</ul>
);

/** Post or edit a project idea. A club project (core team only) can be left open to everyone by leaving the team size empty. */
export function IdeaForm({ initial, club = false, busy, submit, cancel }: { initial?: Idea; club?: boolean; busy: boolean; submit: (f: IdeaFields) => Promise<boolean>; cancel?: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? ""); const [summary, setSummary] = useState(initial?.summary ?? "");
  const [domains, setDomains] = useState<string[]>(initial?.domains ?? []); const [skills, setSkills] = useState(skillsText(initial?.skills_wanted ?? []));
  const [size, setSize] = useState(initial?.team_size ? String(initial.team_size) : club ? "" : "4"); const [repo, setRepo] = useState(initial?.repo_url ?? "");
  const [err, setErr] = useState("");
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const sk = parseSkills(skills);
    if (title.trim().length < 3) return setErr("Give it a title of at least 3 characters.");
    if (summary.trim().length < 10) return setErr("Describe it in a sentence or two (at least 10 characters).");
    if (!domains.length) return setErr("Pick at least one area.");
    if (!sk) return setErr(`Skills: up to ${LIMITS.skills}, separated by commas, each 2 to ${LIMITS.skillMax} characters (letters, numbers, + # . -).`);
    const n = size.trim() === "" ? null : Number(size);
    if (n === null && !club) return setErr("Say how many people you need (2 to 12).");
    if (n !== null && !(Number.isInteger(n) && n >= LIMITS.teamMin && n <= LIMITS.teamMax)) return setErr("A team is 2 to 12 people.");
    if (repo.trim() && !REPO_RE.test(repo.trim())) return setErr("The repository link should look like https://github.com/owner/name.");
    if (await submit({ title: title.trim(), summary: summary.trim(), domains, skills: sk, teamSize: n, repo: repo.trim() }) && !initial) { setTitle(""); setSummary(""); setDomains([]); setSkills(""); setRepo(""); }
  };
  return (
    <form onSubmit={go} noValidate className="space-y-4">
      <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Title</span><input className={field} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block"><span className="mb-1.5 block text-[14px] font-medium">What is it, and who is it for?</span><textarea className={field} rows={3} value={summary} maxLength={LIMITS.summary} onChange={(e) => setSummary(e.target.value)} /></label>
      <AreaPicker value={domains} onChange={setDomains} max={LIMITS.domainsIdea} legend="Areas" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Skills you are looking for <span className="font-normal text-ink-3">(commas)</span></span><input className={field} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="react, figma, python" /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">People needed {club ? <span className="font-normal text-ink-3">(empty = open to everyone)</span> : <span className="font-normal text-ink-3">(including you)</span>}</span><input className={field} inputMode="numeric" value={size} onChange={(e) => setSize(e.target.value)} /></label>
      </div>
      <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Repository <span className="font-normal text-ink-3">(optional, github.com/owner/name)</span></span><input className={field} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/gcc-gitam-blr/…" /></label>
      <p role="alert" className="min-h-[1.5em] text-[14.5px] text-red-600">{err}</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className={btn}>{initial ? "Save changes" : club ? "Post the club project" : "Share the idea"}</button>
        {cancel && <button type="button" onClick={cancel} className={btnSoft}>Cancel</button>}
      </div>
      <p className="text-[13px] text-ink-3">Never include passwords, keys or anything personal. Only members can see this until the core team features it.</p>
    </form>
  );
}

export { domainLabel };
