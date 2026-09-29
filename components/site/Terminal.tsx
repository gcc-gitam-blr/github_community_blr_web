"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CLUB, commitHash } from "@/lib/config";
import { EPOCH } from "@/lib/epoch/config";
import { Head } from "./Sections";

type Line = { id: number; html?: string; cmd?: string; dim?: boolean };
/* The real calendar as `git log` — same hashes as the timeline above. */
const LOG = [...CLUB.events].sort((x, y) => y.date.localeCompare(x.date)).map((e, i) => `${commitHash(e.title + e.date)} ${i === 0 ? "(HEAD -> main) " : ""}${e.type.toLowerCase()}: ${e.title}`);
const c = (cls: string, s: string) => `<span class="${cls}">${s}</span>`;

export function Terminal() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [val, setVal] = useState("");
  const hist = useRef<string[]>([]); const hi = useRef(0);
  const body = useRef<HTMLDivElement>(null); const input = useRef<HTMLInputElement>(null); const n = useRef(0);

  const push = (...ls: Omit<Line, "id">[]) => setLines((p) => [...p, ...ls.map((l) => ({ ...l, id: n.current++ }))]);

  useEffect(() => {
    setLines([]); n.current = 0;
    push({ html: `${c("text-[#6b7a70]", "Welcome to the club shell. Type")} ${c("text-brand", "help")} ${c("text-[#6b7a70]", "to begin.")}` }, { html: "" },
      ...LOG.map((l) => ({ html: `${c("text-[#f0b429]", l.slice(0, 7))} ${l.slice(8)}` })), { html: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { body.current?.scrollTo({ top: body.current.scrollHeight }); }, [lines]);

  const run = (raw: string) => {
    push({ cmd: raw });
    const k = raw.toLowerCase();
    const say = (...h: string[]) => push(...h.map((html) => ({ html })));
    switch (k) {
      case "help": return say(...["about  who we are", "learn  what you'll learn", "events  upcoming events", "epoch  our annual fest", "log  commit history", "join  jump to sign-up", "clear  clean the screen"].map((l) => { const [a, ...b] = l.split("  "); return `  ${c("text-brand", a.padEnd(8))}${b.join("")}`; }));
      case "about": return say(CLUB.name, `${CLUB.university} · ${CLUB.year}`, "Students who learn, build and merge together.");
      case "learn": return say(...CLUB.learn.map((t) => `${c("text-node-purple", "◆")} ${t.title.padEnd(16)} ${c("text-[#6b7a70]", t.text.split(".")[0])}`));
      case "events": return say(...[...CLUB.events].sort((a, b) => a.date.localeCompare(b.date)).map((e) => `${c("text-[#f0b429]", e.date)}  ${e.title} ${c("text-[#6b7a70]", "— " + e.where)}`));
      case "log": return say(...LOG.map((l) => `${c("text-[#f0b429]", l.slice(0, 7))} ${l.slice(8)}`));
      case "epoch": say(`Opening ${c("text-gold", EPOCH.name + "'" + EPOCH.edition)} — ${EPOCH.month}…`); return void setTimeout(() => router.push("/epoch"), 600);
      case "join": say(c("text-brand", "Taking you to the sign-up form…")); return void document.getElementById("join")?.scrollIntoView({ behavior: "smooth", block: "center" });
      case "clear": return setLines([]);
      case "whoami": return say("a future contributor.");
      case "ls": return say(`${c("text-node-purple", "workshops/")}  ${c("text-node-purple", "hackathons/")}  ${c("text-node-purple", "epoch/")}  README.md`);
      case "git status": return say(`On branch ${c("text-brand", "main")}`, "nothing to commit, but plenty to build.");
      default: return say(`command not found: ${c("text-brand", raw.replace(/[<>&]/g, ""))} — try ${c("text-brand", "help")}`);
    }
  };

  return (
    <section id="terminal" className="relative overflow-hidden bg-[#0b0d12] py-[clamp(64px,8vw,112px)] text-white">
      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]">
        <Head light tag="// terminal" title={<>Talk to the club,<br />the way we do.</>}>A tiny interactive shell. Try <kbd className="rounded border border-[#2c333d] bg-[#1a1f27] px-2 py-0.5 font-mono text-[.85em] text-brand">help</kbd> or <kbd className="rounded border border-[#2c333d] bg-[#1a1f27] px-2 py-0.5 font-mono text-[.85em] text-brand">epoch</kbd>.</Head>
        <div onClick={() => !window.getSelection()?.toString() && input.current?.focus({ preventScroll: true })} className="max-w-[940px] overflow-hidden rounded-[18px] border border-[#262d38] bg-[#0f1319] font-mono text-[13px] leading-[1.7] shadow-[0_50px_100px_-30px_rgba(63,200,78,.28)] sm:text-[15px]" role="application" aria-label="Interactive club terminal">
          <div className="flex items-center gap-2 border-b border-[#262d38] bg-[#171c25] px-[18px] py-3.5"><i className="h-3 w-3 rounded-full bg-[#ff5f57]" /><i className="h-3 w-3 rounded-full bg-[#febc2e]" /><i className="h-3 w-3 rounded-full bg-[#28c840]" /><span className="ml-3 text-[13px] text-[#6b7a70]">blr@github-community: ~</span></div>
          <div ref={body} aria-live="polite" className="h-[340px] overflow-y-auto px-4 pb-1 pt-[22px] text-[#d8f5dd] sm:h-[400px] sm:px-6">
            {lines.map((l) => l.cmd !== undefined
              ? <p key={l.id}><span className="text-brand">➜ ~ </span>{l.cmd}</p>
              : <p key={l.id} className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: l.html || "&nbsp;" }} />)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); const r = val.trim(); setVal(""); if (!r) return; hist.current.push(r); hi.current = hist.current.length; run(r); }} className="flex items-center gap-3 px-4 pb-[22px] pt-2.5 sm:px-6">
            <span className="text-brand">➜ ~</span>
            <input ref={input} value={val} onChange={(e) => setVal(e.target.value)} aria-label="Terminal command" spellCheck={false} autoCapitalize="off" autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" && hist.current.length) { e.preventDefault(); hi.current = Math.max(0, hi.current - 1); setVal(hist.current[hi.current]); }
                if (e.key === "ArrowDown") { e.preventDefault(); hi.current = Math.min(hist.current.length, hi.current + 1); setVal(hist.current[hi.current] ?? ""); }
              }}
              className="flex-1 bg-transparent text-white caret-brand outline-none" />
          </form>
        </div>
      </div>
    </section>
  );
}
