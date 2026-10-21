"use client";
import { JoinForm, JoinedPanel, useJoined } from "./QuickJoin";

/* Joining, shaped like a pull request into the club: name and email are the commit. The button itself says plainly what it does ("Join the club"): the site is for people new to Git.
   The same two steps as the hero (components/site/QuickJoin.tsx): after merging, the optional extras. */
export function JoinCard() {
  const [joined] = useJoined();
  const branch = joined ? joined.name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9-]/g, "") || "you" : "you";
  return (
    <div className="relative rounded-[18px] border border-line bg-white p-8 shadow-[0_30px_80px_-30px_rgba(11,11,15,.25)] md:p-10">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 flex-none place-items-center rounded-full ${joined ? "bg-[#8250df]" : "bg-[#2ea043]"}`} aria-hidden>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="#fff"><path d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9.573.677A.25.25 0 0110 .854V2.5h1A2.5 2.5 0 0113.5 5v5.628a2.251 2.251 0 11-1.5 0V5a1 1 0 00-1-1h-1v1.646a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354z" /></svg>
          </span>
          <h2 className="text-[30px]">{joined ? "Merged" : "Join the club"} <span className="font-sans text-[20px] font-normal text-ink-3">#new</span></h2>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[12.5px] text-ink-3">
          {joined ? "merged into" : "wants to merge into"}
          <span className="rounded-md bg-[#ddf4ff] px-2 py-0.5 text-[#0550ae]">club:main</span>from
          <span className="break-all rounded-md bg-[#ddf4ff] px-2 py-0.5 text-[#0550ae]">{branch}:first-commit</span>
        </p>
      </div>
      {joined ? <JoinedPanel joined={joined} /> : <JoinForm tone="card" />}
      <p className="mt-4 text-[13px] text-ink-3">Only club news: the next session, Epoch, the newsletter. Unsubscribe in one click. <a href="/privacy" className="underline underline-offset-2">Privacy</a></p>
    </div>
  );
}
