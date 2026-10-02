import { Reveal } from "@/components/ui/Reveal";
import { LiveSticker } from "@/components/ui/LiveSticker";

/* A plain-language primer for people who've never used GitHub — before anything club-specific.
   Each idea gets a tiny diagram drawn in the site's git-graph style. */

const INK = "#0b0b0f";
const Dot = ({ x, y, fill = "#b9e0f7", r = 9 }: { x: number; y: number; fill?: string; r?: number }) => <circle cx={x} cy={y} r={r} fill={fill} stroke={INK} strokeWidth={3} />;

/* 1 · Git: a line of save points, with a branch to try an idea */
const GitArt = () => (
  <svg viewBox="0 0 220 90" className="h-[90px] w-full" aria-hidden>
    <path d="M20 60 H200" stroke={INK} strokeWidth={3} fill="none" />
    <path d="M80 60 C 95 60 95 28 112 28 H150 C 165 28 165 60 180 60" stroke={INK} strokeWidth={3} fill="none" />
    <Dot x={30} y={60} /><Dot x={80} y={60} /><Dot x={130} y={60} /><Dot x={180} y={60} fill="#4fd1a1" />
    <Dot x={120} y={28} fill="#d9c8f7" /><Dot x={150} y={28} fill="#d9c8f7" />
    <text x={30} y={86} textAnchor="middle" fontSize={11} fontFamily="var(--font-jbm)" fill="#3a3d44">v1</text>
    <text x={180} y={86} textAnchor="middle" fontSize={11} fontFamily="var(--font-jbm)" fill="#3a3d44">now</text>
  </svg>
);

/* 2 · GitHub: your laptop pushes the project up to a repository everyone can reach */
const GitHubArt = () => (
  <svg viewBox="0 0 220 90" className="h-[90px] w-full" aria-hidden>
    <rect x={12} y={46} width={62} height={36} rx={6} fill="#fff" stroke={INK} strokeWidth={3} />
    <path d="M4 86 H82" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    <text x={43} y={69} textAnchor="middle" fontSize={11} fontFamily="var(--font-jbm)" fill="#3a3d44">you</text>
    <path d="M78 58 C 108 58 108 30 136 30" stroke={INK} strokeWidth={3} fill="none" strokeDasharray="5 5" />
    <path d="M128 23 L138 30 L128 37" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <rect x={142} y={8} width={70} height={46} rx={8} fill="#2ea043" stroke={INK} strokeWidth={3} />
    <text x={177} y={36} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="var(--font-jbm)" fill="#fff">repo</text>
    <text x={177} y={76} textAnchor="middle" fontSize={11} fontFamily="var(--font-jbm)" fill="#3a3d44">git push</text>
  </svg>
);

/* 3 · Pull requests: someone else's change is reviewed, then merged in */
const PRArt = () => (
  <svg viewBox="0 0 220 90" className="h-[90px] w-full" aria-hidden>
    <path d="M20 62 H200" stroke={INK} strokeWidth={3} fill="none" />
    <path d="M50 62 C 65 62 65 26 82 26 H130 C 150 26 150 62 168 62" stroke={INK} strokeWidth={3} fill="none" />
    <Dot x={30} y={62} /><Dot x={90} y={62} /><Dot x={168} y={62} fill="#2ea043" r={11} />
    <Dot x={92} y={26} fill="#ffd966" /><Dot x={122} y={26} fill="#ffd966" />
    <path d="M161 62 l5 5 l9 -10" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <text x={107} y={12} textAnchor="middle" fontSize={11} fontFamily="var(--font-jbm)" fill="#3a3d44">a friend&apos;s change</text>
    <text x={168} y={86} textAnchor="middle" fontSize={11} fontFamily="var(--font-jbm)" fill="#3a3d44">merged</text>
  </svg>
);

const IDEAS = [
  { k: "Git", t: "Save points for your code", d: "Git records every change you make as a commit. You can look back, undo a mistake, or try an idea on a branch without breaking what already works.", Art: GitArt },
  { k: "GitHub", t: "Your code, online and shared", d: "GitHub keeps your Git projects — called repositories — online, so they're backed up, easy to share, and open to working on with anyone, from anywhere.", Art: GitHubArt },
  { k: "Pull requests", t: "How people build together", d: "Someone suggests a change, others review it, and when it's right it's merged in. That's how teams — and the whole open-source world — make software.", Art: PRArt },
];

export function WhatIsGitHub() {
  return (
    <section id="github" className="py-[clamp(64px,8vw,112px)]">
      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]">
        <div className="flex items-end justify-between gap-6">
          <Reveal className="mb-[clamp(36px,5vw,56px)] max-w-[760px]">
            <span className="font-mono text-[13px] text-ink-2">{"// new to github?"}</span>
            <h2 className="mt-4 text-[clamp(38px,5.6vw,68px)]">What is GitHub,<br />and why learn it?</h2>
            <p className="mt-5 max-w-[60ch] text-[19px] text-ink-2">GitHub is where the world builds software together. It&apos;s built on Git, and it&apos;s how developers save their work, share it, and improve each other&apos;s code. Here&apos;s the idea in three parts.</p>
          </Reveal>
          <LiveSticker name="cat-3d" size={170} className="mb-8 hidden flex-none md:block" />
        </div>

        <ol className="grid gap-5 md:grid-cols-3">
          {IDEAS.map(({ k, t, d, Art }, i) => (
            <Reveal as="li" key={k} delay={i * 0.08} className="flex flex-col rounded-[18px] border border-line bg-white p-6">
              <div className="rounded-[12px] bg-soft px-2 py-3"><Art /></div>
              <p className="mt-5 font-mono text-[13px] text-ink-3">{String(i + 1).padStart(2, "0")} · {k}</p>
              <h3 className="mt-1 text-[22px]">{t}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{d}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-8 flex flex-col gap-3 rounded-[18px] border-2 border-ink bg-[#dafbe1] p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[70ch] text-[17px]"><b>Why it matters for you:</b> it&apos;s how real software teams work, it&apos;s the heart of open source, and your GitHub profile becomes a portfolio that recruiters and collaborators can actually see.</p>
          <a href="#about" className="flex-none font-semibold text-link">How the club helps →</a>
        </Reveal>
      </div>
    </section>
  );
}
