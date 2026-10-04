import { FlameIcon, GitMergeIcon, RepoIcon, RocketIcon, TrophyIcon } from "@primer/octicons-react";
import type { Badge, BadgeId } from "@/lib/badges";

/* Badge chips, in GitHub's label colours (they have dark-mode versions too). */
const LOOK: Record<BadgeId, { Icon: typeof GitMergeIcon; tone: string }> = {
  "first-merge": { Icon: GitMergeIcon, tone: "bg-[#fbefff] text-[#8250df] border-[#c297ff66]" },
  "five-merged": { Icon: FlameIcon, tone: "bg-[#fff8c5] text-[#9a6700] border-[#d4a72c66]" },
  "ten-merged": { Icon: RocketIcon, tone: "bg-[#ffebe9] text-[#cf222e] border-[#ff818266]" },
  "three-projects": { Icon: RepoIcon, tone: "bg-[#ddf4ff] text-[#0550ae] border-[#54aeff66]" },
  challenge: { Icon: TrophyIcon, tone: "bg-[#dafbe1] text-[#1a7f37] border-[#4ac26b66]" },
};

export function BadgeChip({ b, size = "sm" }: { b: Badge; size?: "sm" | "lg" }) {
  const { Icon, tone } = LOOK[b.id];
  return size === "sm"
    ? <span title={b.how} className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[12px] font-semibold ${tone}`}><Icon size={12} />{b.name}</span>
    : <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[15px] font-semibold ${tone}`}><Icon size={16} />{b.name}</span>;
}

export function BadgeRow({ badges }: { badges: Badge[] }) {
  if (!badges.length) return null;
  return <span className="mt-1.5 flex flex-wrap gap-1.5">{badges.map((b) => <BadgeChip key={b.id} b={b} />)}</span>;
}
