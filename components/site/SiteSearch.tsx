"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { SearchIcon } from "@primer/octicons-react";
import { baseIndex, search, type Entry } from "@/lib/search";

/* Site search. Press / or Ctrl+K anywhere on the club pages, or use the button in the header.
   Opened from the keyboard it appears instantly (shortcuts must never feel slow); from a click it fades in briefly. */
const KIND_STYLE: Record<Entry["kind"], string> = {
  Page: "bg-[#ddf4ff] text-[#0550ae]", Section: "border border-line bg-white text-ink-2", Event: "bg-[#dafbe1] text-[#116329]",
  Update: "bg-[#fbefff] text-[#6e40c9]", Question: "bg-[#fff8c5] text-[#7d4e00]", "Git command": "bg-ink text-brand",
};

export function SiteSearch() {
  const [open, setOpen] = useState<null | "key" | "click">(null);
  const [q, setQ] = useState(""); const [i, setI] = useState(0);
  const [extra, setExtra] = useState<Entry[] | null>(null);
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLUListElement>(null), back = useRef<HTMLElement | null>(null);
  const id = useId();
  const index = useMemo(() => [...baseIndex(), ...(extra ?? [])], [extra]);
  const results = useMemo(() => search(index, q), [index, q]);

  const show = useCallback((how: "key" | "click") => { back.current = document.activeElement as HTMLElement; setQ(""); setI(0); setOpen(how); }, []);
  const close = useCallback(() => { setOpen(null); back.current?.focus?.(); }, []);

  // keyboard shortcuts: "/" (when not typing) and Ctrl/Cmd+K
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null; const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); show("key"); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [show]);

  // while open: focus the field, stop the page scrolling, and load the update posts once
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const html = document.documentElement, prev = html.style.overflow; html.style.overflow = "hidden";
    if (!extra) fetch("/search.json").then((r) => (r.ok ? r.json() : [])).then(setExtra).catch(() => setExtra([]));
    return () => { html.style.overflow = prev; };
  }, [open, extra]);

  useEffect(() => { list.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" }); }, [i]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => Math.min(results.length - 1, n + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
    else if (e.key === "Enter" && results[i]) { e.preventDefault(); list.current?.querySelector<HTMLAnchorElement>(`[data-i="${i}"]`)?.click(); }
    else if (e.key === "Tab") e.preventDefault(); // keep focus in the dialog; arrows move through results
  };

  return (
    <>
      <button type="button" onClick={() => show("click")} aria-label="Search the site" aria-keyshortcuts="/ Control+K"
        className="ml-auto inline-flex h-10 flex-none items-center justify-center gap-1.5 rounded-full px-2.5 text-ink-2 transition-colors duration-150 hover:bg-black/[.05] hover:text-ink lg:ml-0 lg:h-9">
        <SearchIcon size={17} /><span className="sr-only">Search</span>
        <kbd className="hidden rounded border border-line bg-white/80 px-1.5 font-mono text-[11.5px] text-ink-3 xl:inline">/</kbd>
      </button>

      {open && (
        <div className={`fixed inset-0 z-[60] ${open === "click" ? "search-in" : ""}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="search-scrim pointer-events-none absolute inset-0 bg-[rgba(11,11,15,.28)]" aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Search the site" onKeyDown={onKey}
            className="search-panel relative mx-auto mt-[12vh] w-[calc(100%-32px)] max-w-[620px] overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_30px_80px_-20px_rgba(11,11,15,.45)]">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <SearchIcon size={18} className="flex-none text-ink-3" />
              <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="Search events, updates, Git commands…"
                role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={results[i] ? `${id}-${i}` : undefined} aria-autocomplete="list" aria-label="Search the site"
                className="h-14 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-ink-3 search-input" spellCheck={false} autoComplete="off" />
              <button type="button" onClick={close} className="rounded border border-line px-1.5 py-0.5 font-mono text-[11.5px] text-ink-3 hover:text-ink">esc</button>
            </div>
            <ul ref={list} id={`${id}-list`} role="listbox" aria-label="Results" className="max-h-[min(60vh,440px)] overflow-y-auto p-2" data-lenis-prevent>
              {results.length === 0 && <li className="px-3 py-8 text-center text-[15px] text-ink-3">No results for “{q}”. Try “events”, “learn” or a Git command like “stash”.</li>}
              {results.map((r, n) => (
                <li key={`${r.kind}${r.href}${r.title}`} id={`${id}-${n}`} role="option" aria-selected={n === i}>
                  <a href={r.href} data-i={n} onClick={() => setOpen(null)} onMouseMove={() => setI(n)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${n === i ? "bg-soft" : ""}`}>
                    <span className={`w-[104px] flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-center text-[11.5px] font-semibold ${KIND_STYLE[r.kind]}`}>{r.kind}</span>
                    <span className="min-w-0">
                      <span className={`block truncate text-[15px] font-semibold ${r.kind === "Git command" ? "font-mono" : ""}`}>{r.title}</span>
                      <span className="block truncate text-[13.5px] text-ink-3">{r.hint}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="hidden gap-4 border-t border-line bg-soft px-4 py-2 text-[12px] text-ink-3 sm:flex"><span><kbd className="font-mono">↑ ↓</kbd> move</span><span><kbd className="font-mono">↵</kbd> open</span><span><kbd className="font-mono">esc</kbd> close</span></p>
          </div>
        </div>
      )}
    </>
  );
}
