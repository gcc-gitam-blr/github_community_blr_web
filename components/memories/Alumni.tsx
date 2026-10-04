import Link from "next/link";
import { LinkExternalIcon, RepoForkedIcon } from "@primer/octicons-react";
import { Face } from "@/components/site/Team";
import { Reveal } from "@/components/ui/Reveal";
import type { Alum } from "@/lib/alumni";

/* "Where they are now": alumni as forks of the club, each gone off to build something new.
   Only people who agreed to be listed; until there are any, an invitation to past members instead. */
export function Alumni({ alumni }: { alumni: Alum[] }) {
  return (
    <section id="alumni" aria-labelledby="alumni-h" className="mt-28 border-t border-line pt-16 sm:mt-36 sm:pt-20">
      <Reveal>
        <p className="font-mono text-[13px] text-ink-2">{"// git remote -v"}</p>
        <h2 id="alumni-h" className="mt-4 text-[clamp(40px,6.4vw,84px)] leading-[0.98]">Where they are now.</h2>
        <p className="mt-6 max-w-[54ch] text-[19px] leading-relaxed text-ink-2">Every member who moves on is a fork of the club: same history, new places to build. Here&apos;s where some of them took it.</p>
      </Reveal>
      {alumni.length ? (
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {alumni.map((a, i) => (
            <li key={a.name + a.years} className="flex gap-4 rounded-[18px] border border-line bg-white p-5">
              <span className="h-14 w-14 flex-none overflow-hidden rounded-full border border-line bg-soft"><Face p={a} px={56} i={i} text="text-[18px]" /></span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2"><span className="text-[19px] font-semibold">{a.name}</span>{a.link && <a href={a.link} target="_blank" rel="noopener" aria-label={`${a.name}'s profile`} className="text-ink-3 hover:text-link"><LinkExternalIcon size={14} /></a>}</p>
                <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[12.5px] text-ink-3"><RepoForkedIcon size={13} />forked {a.years}{a.role ? ` · ${a.role}` : ""}</p>
                <p className="mt-2 text-[17px] font-medium leading-snug">{a.now}</p>
                {a.quote && <blockquote className="mt-2 border-l-2 border-line pl-3 text-[15px] leading-relaxed text-ink-2">{a.quote}</blockquote>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-12 flex flex-col gap-4 rounded-[18px] border-2 border-dashed border-line p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <p className="flex max-w-[52ch] gap-3 text-[17px] text-ink-2"><RepoForkedIcon size={20} className="mt-1 flex-none text-ink-3" />Were you in the club? Tell us what you&apos;re doing now, from internships to research to your own startup, and we&apos;ll add you here. Only with your okay.</p>
          <Link href="/get-involved" className="press inline-flex flex-none rounded-md bg-ink px-5 py-3 font-display font-bold text-white transition-colors duration-150 hover:bg-ink/85">Tell us where you are</Link>
        </div>
      )}
    </section>
  );
}
