"use client";
import { useState } from "react";

/* Phones: a long list shows its first few, with a button for the rest (app/globals.css .show-some). From 640px up
   everything shows and the button isn't there. The cut is made by CSS position, so it holds after <Shuffled> reorders. */
export function ShowAll({ total, label, children }: { total: number; label: string; children: React.ReactNode }) {
  const [all, setAll] = useState(false);
  return (
    <>
      <div className="show-some contents" data-all={all}>{children}</div>
      {!all && total > 10 && (
        <button onClick={() => setAll(true)} className="press rounded-full border border-line px-3.5 py-1.5 text-[14px] font-semibold text-ink-2 transition-colors duration-150 hover:border-ink/40 hover:text-ink sm:hidden">
          {label} <span aria-hidden>↓</span>
        </button>
      )}
    </>
  );
}
