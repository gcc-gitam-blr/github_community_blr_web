import Link from "next/link";
import { CheckCircleIcon, GitMergeIcon, IssueOpenedIcon, TagIcon } from "@primer/octicons-react";
import { Face } from "@/components/site/Team";
import { Sticker } from "@/components/ui/Sticker";
import { daysLeft, type Challenge as C, type ChallengeState, type Progress } from "@/lib/challenge";

/* The challenge at the top of /board, drawn like a GitHub milestone: an Open/Finished state, the people who reached
   the goal listed like a release's contributors (with the purple "merged" badge), and everyone else as a little
   commit track filling up towards the merge. */
const day = (d: string, month: "short" | "long" = "short") => new Date(d.length === 10 ? `${d}T12:00:00+05:30` : d).toLocaleDateString("en-IN", { day: "numeric", month, timeZone: "Asia/Kolkata" });
const SHOWN = 8; // the rest are summarised, so the board's top never becomes a long list

function Track({ n, goal }: { n: number; goal: number }) {
  if (goal > 10) return <span className="block h-2 w-full max-w-[200px] rounded-full bg-line"><span className="block h-2 rounded-full bg-[#8250df]" style={{ width: `${(n / goal) * 100}%` }} /></span>;
  return (
    <span className="relative flex w-fit items-center gap-2" aria-hidden>
      <span className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 bg-line" />
      {Array.from({ length: goal }, (_, i) => <span key={i} className={`relative h-3 w-3 rounded-full border-2 ${i < n ? "border-[#8250df] bg-[#8250df]" : "border-[#c4cad0] bg-white"}`} />)}
    </span>
  );
}

const Avatar = ({ p, i, px = 36 }: { p: Progress; i: number; px?: number }) => <span className="shrink-0 overflow-hidden rounded-full border border-line bg-soft" style={{ width: px, height: px }}><Face p={p.member} px={px} i={i} text="text-[12px]" /></span>;

export function Challenge({ c, state, done, going, sample, now = new Date() }: { c: C; state: ChallengeState; done: Progress[]; going: Progress[]; sample?: boolean; now?: Date }) {
  const on = state === "on", left = daysLeft(c, now);
  const shown = going.slice(0, SHOWN), more = going.length - shown.length;
  return (
    <section aria-labelledby="challenge" className="mt-12 overflow-hidden rounded-[14px] border border-line bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-soft px-5 py-3.5 text-[13.5px] sm:px-7">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-white ${on ? "bg-[#1f883d]" : "bg-[#8250df]"}`}>{on ? <IssueOpenedIcon size={14} /> : <CheckCircleIcon size={14} />}{on ? "Open" : "Finished"}</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-ink-2"><TagIcon size={14} />{day(c.from)} – {day(c.to)}</span>
        <span className="font-mono text-ink-2 sm:ml-auto">{on ? (left === 1 ? "last day today" : `${left} days left`) : `ended ${day(c.to, "long")}`}</span>
      </div>
      <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <p className="font-mono text-[13px] text-ink-3">{sample ? "// sample challenge, previews only" : "// challenge"}</p>
          <h2 id="challenge" className="mt-2 text-[clamp(28px,3.6vw,42px)]">{c.name}</h2>
          {c.description && <p className="mt-3 max-w-[52ch] text-[17px] text-ink-2">{c.description}</p>}
          <p className="mt-4 flex items-center gap-2.5 text-[15.5px]"><GitMergeIcon size={18} className="shrink-0 text-[#8250df]" /><span><b>Goal: {c.goal} merged pull request{c.goal === 1 ? "" : "s"}</b> into other people&apos;s projects, {day(c.from, "long")} to {day(c.to, "long")} (India time).</span></p>
          {!done.length && !going.length && (
            <p className="mt-6 text-[15.5px] text-ink-2">{on ? <>Nobody has a merge in the challenge yet. The first one starts the graph. <Link href="/contribute" className="font-semibold text-link hover:underline">Find a first issue</Link></> : "Nobody reached a merge in this challenge."}</p>
          )}
          <Sticker name="jetpack" size={96} tilt={-8} className="mt-6 hidden lg:block" alt="" />
        </div>

        {(done.length > 0 || going.length > 0) && (
          <div className="min-w-0 space-y-7">
            {done.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-[19px]">Reached the goal <span className="rounded-full bg-[#8250df1a] px-2 py-0.5 font-mono text-[13px] font-semibold text-[#6639ba]">{done.length}</span></h3>
                <ul className="mt-3 divide-y divide-line rounded-[10px] border border-line">
                  {done.map((p, i) => (
                    <li key={p.member.handle} className="flex items-center gap-3 px-3.5 py-3">
                      <Avatar p={p} i={i} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.member.name}</span>
                        <span className="block font-mono text-[12.5px] text-ink-3">@{p.member.handle} · on {day(p.reachedAt!)}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#8250df] px-2.5 py-1 text-[12.5px] font-semibold text-white"><GitMergeIcon size={12} />Merged {p.merged}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {going.length > 0 && (
              <div>
                <h3 className="text-[19px]">On the way</h3>
                <ul className="mt-3 space-y-3">
                  {shown.map((p, i) => (
                    <li key={p.member.handle} className="flex items-center gap-3">
                      <Avatar p={p} i={i + done.length} px={32} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="truncate text-[15px] font-semibold">{p.member.name}</span><span className="font-mono text-[12.5px] text-ink-3">{p.merged} of {c.goal}</span></span>
                        <span className="mt-1.5 block"><Track n={p.merged} goal={c.goal} /></span>
                      </span>
                    </li>
                  ))}
                </ul>
                {more > 0 && <p className="mt-3 text-[14px] text-ink-2">and {more} more with at least one merge</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
