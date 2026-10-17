"use client";
import { useState } from "react";
import { CheckIcon, ChevronDownIcon, CircleSlashIcon, ClockIcon, DotFillIcon, FileDiffIcon, GitMergeIcon, IssueDraftIcon, PlusIcon, SkipIcon, XIcon } from "@primer/octicons-react";
import type { Shape } from "@/lib/config";

/* The admin's own parts, in one place so every tab reads as one product: cards, buttons, fields, and a state badge
   that speaks GitHub's language. A green dot is live, a clock is waiting on someone, purple with a merge icon is
   finished (merged into the club), red is a no, grey is a draft or set aside. Every colour has a dark-mode twin in
   app/globals.css. */
const motion = "transition-[color,background-color,border-color,scale] duration-150 ease-out"; // colours, plus the press (globals.css)
export const card = "rounded-[14px] border border-line bg-white";
export const btn = `inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[14.5px] font-semibold text-white ${motion} hover:bg-ink/85 disabled:opacity-50`;
export const btnSoft = `inline-flex items-center justify-center gap-2 rounded-md border border-line bg-white px-3.5 py-2 text-[14px] font-semibold ${motion} hover:border-ink/40 disabled:opacity-50`;
export const input = `w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px] ${motion} focus:border-ink/50`;
/** the small grey number next to a heading: "Policies 2" */
export const count = "rounded-full bg-soft px-2 py-0.5 font-mono text-[12px] font-semibold text-ink-2";
/** a card's title row */
export const head = "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3.5";

export type Tone = "new" | "live" | "ok" | "waiting" | "changes" | "blocked" | "no" | "done" | "draft" | "muted";
const TONE: Record<Tone, [string, typeof CheckIcon]> = {
  new: ["border-[#54aeff66] bg-[#ddf4ff] text-[#0550ae]", DotFillIcon],
  live: ["border-[#4ac26b66] bg-[#dafbe1] text-[#116329]", DotFillIcon],
  ok: ["border-[#4ac26b66] bg-[#dafbe1] text-[#116329]", CheckIcon],
  waiting: ["border-[#d4a72c66] bg-[#fff8c5] text-[#7d4e00]", ClockIcon],
  changes: ["border-[#d4a72c66] bg-[#fff8c5] text-[#7d4e00]", FileDiffIcon],
  blocked: ["border-[#ff818266] bg-[#ffebe9] text-[#a40e26]", CircleSlashIcon],
  no: ["border-[#ff818266] bg-[#ffebe9] text-[#a40e26]", XIcon],
  done: ["border-[#c297ff66] bg-[#fbefff] text-[#6639ba]", GitMergeIcon],
  draft: ["border-line bg-soft text-ink-2", IssueDraftIcon],
  muted: ["border-line text-ink-3", SkipIcon],
};

/** A tone's colours alone, for a control that shows a state (a status dropdown that is also the badge). */
export const toneCls = (t: Tone) => TONE[t][0];
export const pillSelect = "cursor-pointer rounded-full border py-[5px] pl-2.5 pr-1 text-[13px] font-semibold disabled:cursor-default";

/** A status, with its meaning in the colour and the icon (never colour alone). */
export function State({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const [cls, Icon] = TONE[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[3px] text-[12.5px] font-semibold leading-none ${cls}`}><Icon size={12} aria-hidden />{children}</span>;
}

/** Who someone is in the club, in the colours of the home page's git graph: admins purple, core blue, volunteers mint. */
const ROLE_BG: Record<string, string> = { admin: "bg-node-purple", core: "bg-node-blue", volunteer: "bg-node-mint" };
export function Role({ role, children }: { role: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border border-ink/15 px-2 py-[3px] text-[12.5px] font-semibold leading-none text-ink ${ROLE_BG[role] ?? "bg-soft"}`}>{children}</span>;
}

/** The menu's groups, each with its own node from the home page's graph, so a group is recognisable at a glance. */
export const GROUPS: Record<string, { shape: Shape; fill: string }> = {
  Club: { shape: "ring", fill: "#4fd1a1" },
  People: { shape: "diamond", fill: "#b48be6" },
  Work: { shape: "square", fill: "#b9e0f7" },
  Site: { shape: "triangle", fill: "#ffd966" },
};

/** A small node: a filled circle with the group's glyph, drawn in ink like the home page's graph. */
export function Node({ group, size = 18 }: { group: keyof typeof GROUPS | string; size?: number }) {
  const g = GROUPS[group] ?? GROUPS.Club;
  const glyph = {
    ring: <circle r={6.5} fill="#fff" stroke="#0b0b0f" strokeWidth={3.5} />,
    diamond: <rect x={-6.5} y={-6.5} width={13} height={13} transform="rotate(45)" fill="none" stroke="#0b0b0f" strokeWidth={3.5} strokeLinejoin="round" />,
    square: <rect x={-7} y={-7} width={14} height={14} fill="none" stroke="#0b0b0f" strokeWidth={3.5} strokeLinejoin="round" />,
    triangle: <path d="M0 -8L8 6.5H-8Z" fill="none" stroke="#0b0b0f" strokeWidth={3.5} strokeLinejoin="round" />,
  }[g.shape];
  return <svg viewBox="-22 -22 44 44" width={size} height={size} aria-hidden className="flex-none"><circle r={19.5} fill={g.fill} stroke="#0b0b0f" strokeWidth={3.5} />{glyph}</svg>;
}

/** A form that waits behind one line ("＋ New task") until it's wanted, so each tab opens on what's there, not on a
    blank form. It stays open while something is being edited (`forceOpen`). */
export function Composer({ id, title, forceOpen = false, children }: { id: string; title: React.ReactNode; forceOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const shown = open || forceOpen;
  return (
    <section className={card} aria-labelledby={id}>
      <h2 className="text-[16px]">
        <button id={id} type="button" aria-expanded={shown} onClick={() => setOpen(!shown)} className="flex w-full items-center gap-3 rounded-[14px] px-5 py-3.5 text-left font-semibold transition-colors duration-150 hover:bg-soft">
          <span aria-hidden className={`grid h-6 w-6 flex-none place-items-center rounded-full transition-colors duration-150 ${shown ? "bg-soft text-ink-2" : "bg-ink text-white"}`}><PlusIcon size={14} /></span>
          {title}
          <ChevronDownIcon size={16} aria-hidden className={`ml-auto text-ink-3 transition-transform duration-200 ease-out ${shown ? "rotate-180" : ""}`} />
        </button>
      </h2>
      {shown && <div className="border-t border-line p-5">{children}</div>}
    </section>
  );
}

/** A line under a form or list after an action: "Saved." in green, or what went wrong in red. */
export function Note({ note }: { note: { k: "ok" | "err"; t: string } | null }) {
  if (!note) return null;
  return <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "ok" ? "bg-[#dafbe1] text-[#116329]" : "bg-[#ffebe9] text-[#a40e26]"}`}>{note.t}</p>;
}
