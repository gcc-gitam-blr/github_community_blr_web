import Link from "next/link";
import { NodeIcon } from "@/components/ui/GitGraph";

/* The club as one branch you walk along: learn → first pull request → merged → build together. Every page on that path
   shows where you are (HEAD) and links to the commits before and after it, so the site reads as one journey rather than
   a pile of pages. Same shapes and colours as the year's path on the home page. */
export type Step = "learn" | "contribute" | "board" | "projects";
const STEPS: { id: Step; href: string; label: string; cmd: string; shape: "diamond" | "ring" | "square" | "triangle"; color: "blue" | "purple" | "mint" | "green" }[] = [
  { id: "learn", href: "/learn", label: "Learn", cmd: "git init", shape: "diamond", color: "blue" },
  { id: "contribute", href: "/contribute", label: "First pull request", cmd: "gh pr create", shape: "ring", color: "purple" },
  { id: "board", href: "/board", label: "Get merged", cmd: "git merge", shape: "square", color: "mint" },
  { id: "projects", href: "/projects", label: "Build together", cmd: "git push", shape: "triangle", color: "green" },
];

export function JourneyRail({ at }: { at: Step }) {
  const head = STEPS.findIndex((s) => s.id === at);
  return (
    <nav aria-label="Your path through the club" className="mt-10 max-w-[760px]">
      <ol className="relative grid grid-cols-4">
        {/* the branch: solid up to HEAD (history), dashed after it (what's next) */}
        <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[22px] h-1 rounded bg-[repeating-linear-gradient(90deg,var(--color-ink)_0_8px,transparent_8px_14px)] opacity-30" />
        <span aria-hidden className="absolute left-[12.5%] top-[22px] h-1 rounded bg-ink" style={{ width: `${(head / (STEPS.length - 1)) * 75}%` }} />
        {STEPS.map((s, i) => {
          const here = i === head;
          const node = (
            <>
              <span className={`relative z-10 rounded-full bg-white p-0.5 transition-transform duration-200 ${here ? "scale-110" : "group-hover:-translate-y-0.5"} ${i > head ? "opacity-60 group-hover:opacity-100" : ""}`}>
                <NodeIcon shape={s.shape} color={s.color} size={here ? 44 : 40} />
              </span>
              <span className={`mt-2 block text-center text-[13px] leading-tight sm:text-[14.5px] ${here ? "font-semibold text-ink" : "text-ink-2 group-hover:text-ink"}`}>{s.label}</span>
              <code className={`mt-1 hidden font-mono text-[11.5px] sm:block ${here ? "text-ink-2" : "text-ink-3"}`}>{s.cmd}</code>
              {here && <span className="mt-1.5 rounded-full bg-ink px-2 py-0.5 font-mono text-[11px] font-bold text-brand">HEAD</span>}
            </>
          );
          return (
            <li key={s.id} className="flex flex-col items-center">
              {here ? <span aria-current="step" className="flex flex-col items-center">{node}</span>
                : <Link href={s.href} className="group flex flex-col items-center rounded-lg px-1 outline-offset-4">{node}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* The big band at the end of a page: what to do next, in the voice of the next commit. Full width, like the home page's
   join band, so every page ends somewhere instead of just stopping. */
export function NextBand({ cmd, title, text, href, cta, second, tone = "brand" }: { cmd: string; title: React.ReactNode; text: string; href: string; cta: string; second?: { href: string; label: string }; tone?: "brand" | "ink" }) {
  const dark = tone === "ink";
  return (
    <section aria-label="What's next" className={`border-y-2 border-ink ${dark ? "bg-ink text-white" : "bg-brand text-ink"}`}>
      <div className="mx-auto grid w-full max-w-[1240px] items-center gap-8 px-5 py-[clamp(56px,7vw,96px)] md:px-[clamp(20px,5vw,72px)] lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className={`font-mono text-[13px] ${dark ? "text-brand" : "text-ink"}`}>{`// ${cmd}`}</p>
          <h2 className="mt-4 text-[clamp(36px,5.2vw,64px)] leading-[0.98]">{title}</h2>
          <p className={`mt-5 max-w-[50ch] text-[18px] ${dark ? "text-[#c9d1cc]" : "text-ink-2"}`}>{text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-6 lg:justify-end">
          <Link href={href} className={`lift rounded-md border-2 px-[26px] py-[15px] font-display font-bold ${dark ? "border-brand bg-brand text-ink" : "border-ink bg-ink text-white"}`}>{cta}</Link>
          {second && <a href={second.href} {...(second.href.endsWith(".ics") ? { download: true } : {})} className={`group inline-flex items-center gap-2 font-semibold ${dark ? "text-white" : "text-ink"} underline-offset-4 hover:underline`}>{second.label} <span className="transition-transform group-hover:translate-x-1">→</span></a>}
        </div>
      </div>
    </section>
  );
}
