import { CLUB } from "@/lib/config";
import { NodeIcon } from "@/components/ui/GitGraph";
import { Reveal } from "@/components/ui/Reveal";

/* The year as one branch: six commits from `git init` to `git tag v1.0.0`.
   Horizontal on wide screens, vertical on phones; the line draws itself as it scrolls in. */
export function LearnPath() {
  const steps = CLUB.learn;

  return (
    <div className="relative">
      {/* wide: horizontal branch */}
      <Reveal group className="hidden lg:block">
        <div className="relative mx-[calc(100%/12)] h-[46px]">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-line" />
          <div className="draw absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-ink" />
          <span className="absolute -left-[74px] top-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-white px-3 py-0.5 font-mono text-[12px] font-bold">main</span>
          <span className="absolute -right-[92px] top-1/2 -translate-y-1/2 rounded-full bg-brand px-3 py-0.5 font-mono text-[12px] font-bold">v1.0.0 🏷</span>
        </div>
        <ol className="stagger -mt-[46px] grid grid-cols-6">
          {steps.map((s, i) => (
            <li key={s.id} style={{ "--sd": `${0.1 + i * 0.1}s` } as React.CSSProperties} className="group flex flex-col items-center px-3 text-center">
              <span className="relative z-10 rounded-full bg-soft p-0.5 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:rotate-12"><NodeIcon shape={s.shape} color={s.color} size={42} /></span>
              <code className="mt-5 rounded-md bg-ink px-2 py-1 font-mono text-[11.5px] text-brand">{s.cmd}</code>
              <h3 className="mt-3 text-[20px] leading-tight">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-snug text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      {/* phones & tablets: vertical branch */}
      <ol className="relative space-y-7 before:absolute before:bottom-4 before:left-[21px] before:top-4 before:w-1 before:rounded before:bg-ink lg:hidden">
        {steps.map((s) => (
          <li key={s.id} className="relative grid grid-cols-[44px_1fr] gap-4">
            <span className="relative z-10 h-fit rounded-full bg-soft p-0.5"><NodeIcon shape={s.shape} color={s.color} size={40} /></span>
            <div>
              <code className="rounded-md bg-ink px-2 py-1 font-mono text-[12px] text-brand">{s.cmd}</code>
              <h3 className="mt-2.5 text-[22px] leading-tight">{s.title}</h3>
              <p className="mt-1.5 text-[15.5px] leading-snug text-ink-2">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
