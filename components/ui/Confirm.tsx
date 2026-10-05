"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon } from "@primer/octicons-react";

/* Our own "are you sure?", instead of the browser's grey confirm() box.
   const [ask, dialog] = useConfirm();  …  if (!(await ask({ title: "Delete this?", danger: true }))) return;  …  render {dialog}
   It's a real <dialog>: Esc and a click outside say no, focus stays inside, and screen readers announce it.
   For something that can't be undone, Cancel has the focus, so a stray Enter doesn't do it. */

export type Ask = {
  title: string;
  body?: React.ReactNode;
  yes?: string;        // the confirm button's words, e.g. "Delete" or "Send 40 emails"
  no?: string;
  danger?: boolean;    // red button, Cancel focused
  dark?: boolean;      // the quiz and Epoch's night screens
  command?: string;    // a small git-style line above the title, e.g. "$ git branch -D friday-quiz"
};

export function useConfirm(): [(a: Ask) => Promise<boolean>, React.ReactNode] {
  const [ask, setAsk] = useState<Ask | null>(null);
  const answer = useRef<((v: boolean) => void) | undefined>(undefined);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => { if (ask && !ref.current?.open) ref.current?.showModal(); }, [ask]);
  useEffect(() => () => answer.current?.(false), []); // unmounted while open: that's a no

  const open = useCallback((a: Ask) => new Promise<boolean>((resolve) => {
    answer.current?.(false); // a second question replaces the first
    answer.current = resolve; setAsk(a);
  }), []);
  const done = (v: boolean) => { answer.current?.(v); answer.current = undefined; ref.current?.close(); setAsk(null); };

  const d = ask?.dark;
  const dialog = ask && (
    <dialog ref={ref} aria-labelledby="confirm-title" aria-describedby={ask.body ? "confirm-body" : undefined}
      onCancel={(e) => { e.preventDefault(); done(false); }}
      onClick={(e) => { if (e.target === ref.current) done(false); }}
      className={`confirm m-auto w-[min(440px,calc(100vw-32px))] rounded-2xl p-0 shadow-[0_24px_60px_-12px_rgba(0,0,0,.45)] ${d ? "border border-white/12 bg-[#16161d] text-white backdrop:bg-black/70" : "border border-[#e4e8e6] bg-white text-[#0b0b0f] backdrop:bg-[#0b0b0f]/40"}`}>
      <div className="p-5 sm:p-6">
        {ask.command && <p className={`mb-3 truncate font-mono text-[12.5px] ${d ? "text-white/45" : "text-[#666a73]"}`}>{ask.command}</p>}
        <div className="flex items-start gap-3">
          {ask.danger && <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${d ? "bg-[#ff7b72]/15 text-[#ff7b72]" : "bg-[#ffebe9] text-[#cf222e]"}`}><AlertIcon size={16} /></span>}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-[20px] leading-tight [font-stretch:105%]">{ask.title}</h2>
            {ask.body && <div id="confirm-body" className={`mt-2 text-[15px] leading-relaxed ${d ? "text-white/65" : "text-[#3a3d44]"}`}>{ask.body}</div>}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button autoFocus={ask.danger} onClick={() => done(false)}
            className={`rounded-full px-5 py-2.5 text-[15px] font-semibold ${d ? "border border-white/15 text-white/85 hover:bg-white/[0.06]" : "border border-[#d5dedb] text-[#0b0b0f] hover:bg-[#f5f7f6]"}`}>{ask.no ?? "Cancel"}</button>
          <button autoFocus={!ask.danger} onClick={() => done(true)}
            className={`rounded-full px-5 py-2.5 text-[15px] font-bold ${ask.danger ? "bg-[#cf222e] text-white hover:bg-[#a40e26]" : d ? "bg-[#3fc84e] text-[#0b0b0f]" : "bg-[#0b0b0f] text-white"}`}>{ask.yes ?? "OK"}</button>
        </div>
      </div>
    </dialog>
  );
  return [open, dialog];
}
