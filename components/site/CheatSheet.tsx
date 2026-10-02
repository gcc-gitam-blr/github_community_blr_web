"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CopyIcon, SearchIcon } from "@primer/octicons-react";
import { CHEAT } from "@/lib/learn";

/* A Git cheat sheet you can search and copy from. Filtering is instant and works without any network. */
export function CheatSheet() {
  const [q, setQ] = useState(""); const [copied, setCopied] = useState("");
  // arriving from site search (/learn?q=git%20stash#cheat): start filtered
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the address once, after hydration
  useEffect(() => { const v = new URLSearchParams(window.location.search).get("q"); if (v) setQ(v.slice(0, 60)); }, []);
  const groups = useMemo(() => {
    const n = q.trim().toLowerCase();
    return CHEAT.map((g) => ({ ...g, cmds: n ? g.cmds.filter((c) => (c.cmd + " " + c.what + " " + g.group + " " + g.blurb).toLowerCase().includes(n)) : g.cmds })).filter((g) => g.cmds.length);
  }, [q]);

  const copy = async (cmd: string) => {
    try { await navigator.clipboard.writeText(cmd); setCopied(cmd); setTimeout(() => setCopied((c) => (c === cmd ? "" : c)), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div>
      <label className="relative block max-w-[520px]">
        <span className="sr-only">Search commands</span>
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3"><SearchIcon size={18} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: undo, branch, push…" className="w-full rounded-full border border-line bg-white py-3.5 pl-11 pr-5 text-[16px] outline-none transition focus:border-ink" />
      </label>
      <p className="sr-only" role="status" aria-live="polite">{groups.reduce((n, g) => n + g.cmds.length, 0)} commands shown</p>

      {groups.length === 0 && <p className="mt-8 text-[17px] text-ink-2">Nothing matches “{q}”. Try “undo”, “branch” or “push”.</p>}
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.group} className="rounded-[16px] border border-line bg-white p-5 sm:p-6">
            <h3 className="text-[22px]">{g.group}</h3>
            <p className="mb-4 mt-1 text-[14.5px] text-ink-2">{g.blurb}</p>
            <ul className="divide-y divide-line">
              {g.cmds.map((c) => (
                <li key={c.cmd} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <code className="min-w-0 break-words rounded-md bg-[#0d1117] px-2.5 py-1 font-mono text-[13px] leading-6 text-[#7ee787]">{c.cmd}</code>
                    <button onClick={() => copy(c.cmd)} aria-label={`Copy ${c.cmd}`} className="grid h-8 w-8 flex-none place-items-center rounded-md border border-line text-ink-2 transition hover:border-ink hover:text-ink">
                      {copied === c.cmd ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[14.5px] text-ink-2">{c.what}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
