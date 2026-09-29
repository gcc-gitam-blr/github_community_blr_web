import { CLUB } from "@/lib/config";

/* The year's numbers, the way git reports a change: `git diff --stat`. */
export function DiffStat() {
  const rows = CLUB.stats.map((s) => ({ file: s.file, n: s.value }));
  const max = Math.max(...rows.map((r) => r.n));
  const bar = (n: number) => Math.max(1, Math.round((Math.log10(n + 1) / Math.log10(max + 1)) * 24)); // log scale so 2 and 398 both read
  const total = rows.reduce((s, r) => s + r.n, 0);
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-soft/70 px-5 py-4 font-mono text-[13px] leading-[1.9] sm:text-[14px]">
      <p className="text-ink-3">$ git diff --stat club/2025..club/2026-27</p>
      <table className="mt-1 whitespace-nowrap">
        <tbody>
          {rows.map((r) => (
            <tr key={r.file}>
              <td className="pr-3 text-ink-2">{r.file}</td>
              <td className="pr-1 text-ink-3">|</td>
              <td className="pr-2 text-right tabular-nums font-bold">{r.n}</td>
              <td className="tracking-[-0.05em] text-green-600">{"+".repeat(bar(r.n))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-ink-3">{rows.length} files changed, <span className="text-green-600">{total} insertions(+)</span>, 0 deletions(-)</p>
    </div>
  );
}
