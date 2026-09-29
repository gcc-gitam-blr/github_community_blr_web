import { GitGraph, type GNode } from "@/components/ui/GitGraph";
import { Reveal } from "@/components/ui/Reveal";
import { EpochLink } from "@/components/epoch/EpochLink";
import { EPOCH } from "@/lib/epoch/config";
import { JoinCard } from "./JoinCard";

const NODES: GNode[] = [
  { id: "a", lane: 1, row: 0, shape: "diamond", color: "blue", label: "main · first workshop" },
  { id: "b", lane: 1, row: 1, shape: "square", color: "blue", label: "main · hack night" },
  { id: "c", lane: 2, row: 1, shape: "ring", color: "purple", label: "feat/open-source · first PR" },
  { id: "d", lane: 1, row: 2, shape: "diamond", color: "blue", label: "main · 100 members" },
  { id: "e", lane: 2, row: 2, shape: "ring", color: "purple", label: "feat/open-source · merged" },
  { id: "f", lane: 0, row: 3, shape: "triangle", color: "mint", label: "feat/epoch · coins live" },
  { id: "g", lane: 1, row: 3, shape: "square", color: "blue", label: "main · hackathon" },
  { id: "h", lane: 0, row: 4, shape: "triangle", color: "mint", label: "feat/epoch · shipped" },
];
const EDGES: [string, string][] = [["a", "b"], ["a", "c"], ["b", "d"], ["c", "e"], ["d", "f"], ["d", "g"], ["f", "h"]];
const WORDS = ["git init", 'git commit -m "ship it"', "pull requests welcome", "open source", "hackathons", "workshops", "code review", "git push origin main", "good first issue", "epoch coins", "merge conflicts resolved together"];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-[radial-gradient(60%_50%_at_78%_40%,rgba(180,139,230,.10),transparent_70%),radial-gradient(50%_50%_at_10%_90%,rgba(63,200,78,.08),transparent_70%)] pt-[clamp(120px,14vw,170px)]">
      <div className="mx-auto grid min-h-[min(760px,88vh)] w-full max-w-[1240px] items-center gap-2 px-5 pb-16 md:px-[clamp(20px,5vw,72px)] lg:grid-cols-[1.15fr_.85fr_1fr] md:grid-cols-2 max-md:grid-cols-[minmax(0,1fr)]">
        <div className="min-w-0">
          <Reveal>
            <EpochLink className="inline-flex items-center gap-2.5 rounded-full border border-ink/15 bg-white/70 py-1.5 pl-1.5 pr-4 font-mono text-[13px] backdrop-blur transition hover:border-ink">
              <span className="rounded-full bg-ink px-2.5 py-0.5 font-bold text-gold">{EPOCH.name}_{EPOCH.edition}</span>
              {EPOCH.month} · Epoch Coins →
            </EpochLink>
          </Reveal>
          <Reveal delay={0.08}><h1 className="my-7 text-[clamp(64px,8.6vw,122px)] leading-[0.92]">Learn.<br />Build.<br />Merge<span aria-hidden className="ml-[.12em] animate-blink tracking-[-0.08em]">&gt;_</span></h1></Reveal>
          <Reveal delay={0.16}><p className="max-w-[44ch] text-[19px] text-ink-2">The GitHub Community Club at GITAM Bengaluru turns &ldquo;I want to code&rdquo; into pull requests, project launches and real open-source contributions — culminating in Epoch, our flagship technical month.</p></Reveal>
          <Reveal delay={0.24} className="mt-9 flex flex-wrap items-center gap-8">
            <a href="#join" className="lift rounded-md border-2 border-ink bg-ink px-[26px] py-[15px] font-display font-bold text-white">Join the club</a>
            <a href="#events" className="group inline-flex items-center gap-2 font-semibold text-link">See what&apos;s next <span className="transition-transform group-hover:translate-x-1.5">→</span></a>
          </Reveal>
        </div>

        <div aria-hidden className="hidden items-center justify-center self-stretch py-2.5 lg:flex"><GitGraph nodes={NODES} edges={EDGES} className="max-h-[640px] w-full min-w-[230px]" /></div>
        <Reveal delay={0.2} className="min-w-0"><JoinCard /></Reveal>
      </div>

      <div aria-hidden className="overflow-hidden border-y-2 border-ink bg-ink py-4 text-white">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap font-mono text-[15px]">
          {[...WORDS, ...WORDS].map((w, i) => <span key={i} className="inline-flex items-center gap-12">{w}<span className="text-[10px] text-brand">◆</span></span>)}
        </div>
      </div>
    </section>
  );
}
