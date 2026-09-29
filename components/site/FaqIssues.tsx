import { CLUB } from "@/lib/config";
import { Sticker } from "@/components/ui/Sticker";

/* The FAQ as a repository's closed issues: each question is an issue,
   each answer is a comment from the support Octocat. Native <details>, so it works without JS. */
const LABELS: Record<number, { t: string; c: string }[]> = {
  0: [{ t: "epoch", c: "bg-[#ffd966]" }],
  1: [{ t: "epoch", c: "bg-[#ffd966]" }, { t: "coins", c: "bg-[#b9e0f7]" }],
  2: [{ t: "epoch", c: "bg-[#ffd966]" }, { t: "coins", c: "bg-[#b9e0f7]" }],
  3: [{ t: "good first issue", c: "bg-[#b48be6] text-white" }],
  4: [{ t: "question", c: "bg-[#d8f5dd]" }],
};

export function FaqIssues() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-white">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line bg-soft px-5 py-3.5 text-[14px]">
        <span className="font-semibold text-ink-3">○ 0 Open</span>
        <span className="flex items-center gap-1.5 font-semibold"><Check />{CLUB.faq.length} Closed</span>
        <span className="ml-auto font-mono text-[12px] text-ink-3">github-community-blr / questions</span>
      </div>
      <ul>
        {CLUB.faq.map((f, i) => (
          <li key={f.q} className="border-b border-line last:border-0">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 transition hover:bg-soft/60 [&::-webkit-details-marker]:hidden">
                <span className="mt-1"><Check /></span>
                <span className="min-w-0 flex-1">
                  <span className="text-[17px] font-semibold leading-snug group-open:text-link sm:text-[18px]">{f.q}</span>
                  {(LABELS[i] ?? []).map((l) => <span key={l.t} className={`ml-2 inline-block rounded-full px-2 py-px align-middle font-mono text-[11px] font-bold ${l.c}`}>{l.t}</span>)}
                  <span className="mt-1 block font-mono text-[12px] text-ink-3">#{i + 1} · closed as answered by the core team</span>
                </span>
                <span className="mt-1 font-mono text-[12px] text-ink-3">💬 1</span>
              </summary>
              <div className="flex gap-3 px-5 pb-5 pl-[52px]">
                <Sticker name="support" size={40} className="mt-1 flex-none" alt="" />
                <div className="relative flex-1 rounded-xl border border-line">
                  <p className="border-b border-line bg-soft px-4 py-2 font-mono text-[12px] text-ink-3"><b className="text-ink">supportcat</b> commented</p>
                  <p className="px-4 py-3 text-[16px] leading-relaxed text-ink-2">{f.a}</p>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Check() {
  return <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="flex-none fill-[#8250df]"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm3.28 5.22a.75.75 0 00-1.06 0L7 8.44 5.78 7.22a.75.75 0 10-1.06 1.06l1.75 1.75c.3.3.77.3 1.06 0l3.75-3.75a.75.75 0 000-1.06z" /></svg>;
}
