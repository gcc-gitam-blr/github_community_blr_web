"use client";
import { CheckIcon, EyeIcon } from "@primer/octicons-react";
import { card, head } from "./kit";

/* Who sees what, in one table, and "preview as": the admin as the core team or a volunteer sees it, or what a member gets.
   The admin rows come from the same menu list the dashboard uses, so the table can't drift from the truth. The database
   enforces every rule; previewing only changes what this screen shows you, never what you're allowed to do. */
export type Preview = "core" | "volunteer" | "member";
type Section = { id: string; label: string; group: string; admin?: boolean; core?: boolean };
const COLS = ["Member", "Volunteer", "Core team", "Admin"] as const;

const yes = <span className="inline-flex items-center gap-1 text-[#116329]"><CheckIcon size={14} aria-hidden /><span className="sr-only">Yes</span></span>;
const no = <span className="text-ink-3" aria-label="No">·</span>;

export function AccessTable({ sections }: { sections: readonly Section[] }) {
  // a member is anyone on the members list who signs in with GitHub; volunteers, core and admins are appointments
  const site: [string, React.ReactNode[], string?][] = [
    ["The public site, events, Epoch, Learn", [yes, yes, yes, yes], "Everyone, signed in or not."],
    ["My club (/me): their events, certificates, badges", [yes, yes, yes, yes], "Each person sees only their own."],
    ["Project hub (/hub)", [yes, <span key="v" className="text-[13px] text-ink-2">if on the members list</span>, yes, yes], "Members must be on the members list (Members tab) and signed in with the same GitHub username or email."],
    ["Find people in the hub", [<span key="m" className="text-[13px] text-ink-2">people who opted in</span>, <span key="v" className="text-[13px] text-ink-2">if a member</span>, <span key="c" className="text-[13px] text-ink-2">everyone who answered</span>, <span key="a" className="text-[13px] text-ink-2">everyone who answered</span>]],
  ];
  const adminRows = sections.map((s) => [s.label, [no, s.admin || s.core ? no : yes, s.admin ? no : yes, yes]] as [string, React.ReactNode[]]);
  const row = (label: string, cells: React.ReactNode[], note?: string) => (
    <tr key={label} className="border-t border-line align-top">
      <th scope="row" className="px-4 py-2.5 text-left font-medium">{label}{note && <span className="block text-[12.5px] font-normal text-ink-3">{note}</span>}</th>
      {cells.map((c, i) => <td key={i} className="px-3 py-2.5 text-center">{c}</td>)}
    </tr>
  );
  return (
    <section className={card} aria-labelledby="access-h">
      <div className={head}><EyeIcon size={16} aria-hidden /><h2 id="access-h" className="text-[18px]">Who sees what</h2><span className="text-[13.5px] text-ink-3">Use <b>Preview as</b> under the menu to see it for yourself.</span></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[14px]">
          <thead><tr className="bg-soft text-[12.5px] uppercase tracking-[.06em] text-ink-3"><th scope="col" className="px-4 py-2 text-left font-semibold">Where</th>{COLS.map((c) => <th key={c} scope="col" className="px-3 py-2 font-semibold">{c}</th>)}</tr></thead>
          <tbody>
            {site.map(([l, c, n]) => row(l, c, n))}
            <tr className="border-t border-line bg-soft"><th colSpan={5} scope="rowgroup" className="px-4 py-1.5 text-left font-mono text-[12px] font-semibold uppercase tracking-[.08em] text-ink-3">Admin dashboard (/admin)</th></tr>
            {adminRows.map(([l, c]) => row(l, c))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">Within a section the core team mostly reads and proposes; admins also decide, send emails and change access. Nobody approves their own proposal, application or policy, and nobody changes their own access: that needs a second admin.</p>
    </section>
  );
}

/** Under the menu: preview the dashboard as a lower role, or see what a member gets. */
export function PreviewPicker({ real, value, onChange }: { real: string; value: Preview | null; onChange: (p: Preview | null) => void }) {
  const options: [Preview, string][] = real === "admin" ? [["core", "Core team"], ["volunteer", "Volunteer"], ["member", "Member"]] : [["volunteer", "Volunteer"], ["member", "Member"]];
  return (
    <div className="mt-4 md:pl-8">
      <p className="text-[12.5px] font-semibold uppercase tracking-[.08em] text-ink-3">Preview as</p>
      <div role="group" aria-label="Preview the dashboard as" className="mt-1.5 flex flex-wrap gap-1">
        {options.map(([id, label]) => (
          <button key={id} aria-pressed={value === id} onClick={() => onChange(value === id ? null : id)}
            className={`rounded-full border px-2.5 py-1 text-[13px] transition-colors duration-150 ${value === id ? "border-ink bg-ink font-semibold text-white" : "border-line text-ink-2 hover:border-ink/40"}`}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/** The banner while previewing. */
export function PreviewBanner({ as, onStop }: { as: Preview; onStop: () => void }) {
  const name = { core: "the core team", volunteer: "a volunteer", member: "a member" }[as];
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border border-[#d4a72c] bg-[#fff8c5] px-4 py-3 text-[14.5px] text-[#4d2d00]">
      <EyeIcon size={16} aria-hidden />
      <span className="min-w-0 flex-1">Previewing as <b>{name}</b>: the menu and buttons are theirs. It only changes this screen: anything you press still runs as you, so look rather than change.</span>
      <button onClick={onStop} className="rounded-md border border-[#d4a72c] bg-white px-3 py-1.5 text-[13.5px] font-semibold text-[#4d2d00] hover:bg-[#fff8c5]">Stop previewing</button>
    </div>
  );
}

/** What a member gets: they never see the admin, so this shows where they go and opens each page as they'd see it. */
export function MemberPreview() {
  const items: [string, string, string][] = [
    ["/me", "My club", "Their year in the club: events they came to, certificates, merged pull requests and badges, and their Epoch wallet."],
    ["/hub?as=member", "Project hub", "Say what they're into, browse and post project ideas, find teammates who opted in, and manage their teams. Opens as a member sees it."],
    ["/board", "The board", "Pull requests members got merged, if they switch on Show me on the board in My club."],
  ];
  return (
    <section className={card} aria-labelledby="mp-h">
      <div className={head}><h2 id="mp-h" className="text-[18px]">What a member gets</h2><span className="text-[13.5px] text-ink-3">Members have no admin. Besides the public site, these three are theirs:</span></div>
      <ul className="divide-y divide-line">
        {items.map(([href, t, d]) => (
          <li key={href} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-4">
            <span className="min-w-0 flex-1 basis-[260px]"><b className="text-[15.5px]">{t}</b><span className="block text-[14px] text-ink-2">{d}</span></span>
            <a href={href} target="_blank" rel="noopener" className="rounded-md border border-line px-3 py-1.5 text-[14px] font-semibold hover:border-ink/40">Open as a member ↗</a>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">For someone to get the hub, they need a row in <b>Members</b> (active) and to sign in with GitHub using the username or email on that row. The Members list shows who has signed in.</p>
    </section>
  );
}
