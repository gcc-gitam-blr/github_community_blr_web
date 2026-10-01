import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { SPONSORS } from "@/lib/epoch/config";

/* Hidden until there are sponsors. Logos link out; everyone gets a way to become one. */
export function Sponsors() {
  if (!SPONSORS.length) return null;
  return (
    <section className="py-[clamp(56px,8vw,100px)]">
      <div className="mx-auto w-full max-w-[1120px] px-6 md:px-10">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-[clamp(30px,4.4vw,52px)] font-medium tracking-[-0.045em]">With thanks to</h2>
          <Link href="/get-involved?kind=sponsor" className="text-[16px] text-mute underline underline-offset-4 hover:text-ink">Become a sponsor →</Link>
        </Reveal>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SPONSORS.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noopener sponsored" className="grid h-28 place-items-center rounded-[18px] border border-ink/10 bg-white p-5 text-center transition hover:border-ink/40">
                {s.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={s.logo} alt={s.name} className="max-h-14 w-auto" />
                  : <span className="text-[20px] font-medium tracking-[-0.02em]">{s.name}</span>}
                {s.tier && <span className="font-mono text-[11px] uppercase tracking-widest text-mute">{s.tier}</span>}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
