import { GitGraph, type GNode } from "@/components/ui/GitGraph";
import { EpochLink } from "@/components/epoch/EpochLink";
import { EpochCoin } from "@/components/epoch/EpochCoin";
import { EpochInterest } from "@/components/site/EpochInterest";
import { BOOTH_COUNT, EPOCH, STARTER_COINS } from "@/lib/epoch/config";

/* The club's own git history, drawn: main plus two branches that merge back. Decorative. */
const NODES: GNode[] = [
  { id: "a", lane: 1, row: 0, shape: "diamond", color: "blue", label: "main · first workshop" },
  { id: "b", lane: 1, row: 1, shape: "square", color: "blue", label: "main · GIT Merge 26" },
  { id: "c", lane: 2, row: 1, shape: "ring", color: "purple", label: "feat/open-source · first PR" },
  { id: "d", lane: 1, row: 2, shape: "diamond", color: "blue", label: "main · Build & Deploy" },
  { id: "e", lane: 2, row: 2, shape: "ring", color: "purple", label: "feat/open-source · merged" },
  { id: "f", lane: 0, row: 3, shape: "triangle", color: "mint", label: "feat/epoch · coins live" },
  { id: "g", lane: 1, row: 3, shape: "square", color: "blue", label: "main · Profile Makeover" },
  { id: "h", lane: 0, row: 4, shape: "triangle", color: "mint", label: "feat/epoch · shipped" },
];
const EDGES: [string, string][] = [["a", "b"], ["a", "c"], ["b", "d"], ["c", "e"], ["d", "f"], ["d", "g"], ["f", "h"]];

export function Hero() {
  return (
    <>
      <section id="top" className="relative overflow-hidden bg-[radial-gradient(60%_50%_at_82%_40%,rgba(180,139,230,.10),transparent_70%),radial-gradient(50%_50%_at_8%_90%,rgba(63,200,78,.08),transparent_70%)] pt-[clamp(112px,12vw,150px)]">
        <div className="mx-auto grid w-full max-w-[1240px] items-center gap-10 px-5 pb-[clamp(56px,7vw,96px)] md:px-[clamp(20px,5vw,72px)] lg:grid-cols-[1.25fr_.75fr]">
          <div className="min-w-0">
            <p className="hero-fade mb-6 font-mono text-[13px] text-ink-2">GITAM University Bengaluru · GitHub Community Club</p>
            <div className="hero-rise" style={{ "--d": "0.05s" } as React.CSSProperties}>
              <h1 className="text-[clamp(44px,6.4vw,94px)] leading-[0.94]">Code.<br />Collaborate.<br />Contribute<span aria-hidden className="ml-[.1em] animate-blink tracking-[-0.08em]">&gt;_</span></h1>
            </div>
            <p className="hero-fade mt-8 max-w-[46ch] text-[clamp(18px,1.6vw,20px)] text-ink-2" style={{ "--d": "0.15s" } as React.CSSProperties}>The GitHub Community Club at GITAM Bengaluru. We learn Git and GitHub together, contribute to open source, and run hands-on workshops — no experience needed.</p>
            <div className="hero-fade mt-9 flex flex-wrap items-center gap-8" style={{ "--d": "0.25s" } as React.CSSProperties}>
              <a href="#join" className="lift rounded-md border-2 border-ink bg-ink px-[26px] py-[15px] font-display font-bold text-white">Join the club</a>
              <a href="#events" className="group inline-flex items-center gap-2 font-semibold text-link">See what&apos;s next <span className="transition-transform group-hover:translate-x-1.5">→</span></a>
            </div>
          </div>
          <div aria-hidden className="hidden justify-self-center lg:block"><GitGraph decorative nodes={NODES} edges={EDGES} className="max-h-[560px] w-full min-w-[230px]" /></div>
        </div>
      </section>

      {/* Epoch is the flagship, so it gets a real band, not a pill */}
      <section aria-label="Epoch" className="border-y-2 border-ink bg-ink text-white">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-10 gap-y-5 px-5 py-6 md:px-[clamp(20px,5vw,72px)]">
          <div className="flex items-center gap-4">
            <EpochCoin size={64} />
            <div><p className="font-display text-[32px] font-black lowercase leading-none tracking-[-0.05em]">{EPOCH.name}_{EPOCH.edition}</p><p className="mt-1 font-mono text-[12px] text-[#a9b3ad]">{EPOCH.month} · GITAM Bengaluru</p></div>
          </div>
          <ul className="flex flex-1 flex-wrap gap-x-8 gap-y-2 font-mono text-[13px] text-[#d0d8d3]">
            <li><b className="text-gold">{STARTER_COINS}</b> starter coins</li>
            <li><b className="text-gold">{BOOTH_COUNT}</b> booths</li>
            <li><b className="text-gold">2</b> days</li>
            <li className="hidden sm:block">workshops · contests · one economy</li>
          </ul>
          <EpochLink className="press rounded-full bg-[#ffc933] px-6 py-3 font-display text-[15px] font-bold text-ink transition hover:-translate-y-0.5 hover:bg-[#ffe28f]">Enter Epoch →</EpochLink>
          <EpochInterest dark className="basis-full border-t border-white/10 pt-5 lg:max-w-[860px]" />
        </div>
      </section>
    </>
  );
}
