import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRightIcon } from "@primer/octicons-react";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CheatSheet } from "@/components/site/CheatSheet";
import { Sticker } from "@/components/ui/Sticker";
import { RESOURCES } from "@/lib/learn";

export const metadata: Metadata = { title: "Learn", description: "A searchable Git cheat sheet and the best free resources for learning Git, GitHub and open source." };

const LEVELS = ["Start here", "Next", "Go further"] as const;

export default function Learn() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-[130px] md:px-[clamp(20px,5vw,72px)]">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-[760px]">
            <p className="font-mono text-[13px] text-ink-2">{"// learn"}</p>
            <h1 className="mt-4 text-[clamp(40px,6.4vw,84px)]">Learn Git &amp; GitHub,<br />at your own pace.</h1>
            <p className="mt-5 max-w-[56ch] text-[19px] text-ink-2">Everything we teach in our sessions, in one place — plus the best free material on the internet. Start at the top; skip what you already know.</p>
          </div>
          <Sticker name="professor" size={150} tilt={6} className="mb-4 hidden md:block" alt="" />
        </div>

        <section className="mt-16" aria-labelledby="resources">
          <h2 id="resources" className="text-[clamp(30px,4vw,48px)]">Free resources worth your time</h2>
          {LEVELS.map((lvl) => (
            <div key={lvl} className="mt-8">
              <h3 className="mb-3 font-mono text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-2">{lvl}</h3>
              <ul className="grid gap-4 md:grid-cols-3">
                {RESOURCES.filter((r) => r.level === lvl).map((r) => (
                  <li key={r.url}>
                    <a href={r.url} target="_blank" rel="noopener" className="group flex h-full flex-col rounded-[16px] border border-line bg-white p-5 transition hover:-translate-y-1 hover:border-ink">
                      <span className="flex items-start justify-between gap-3"><span className="text-[19px] font-semibold leading-snug">{r.title}</span><span className="mt-1 text-ink-3 transition group-hover:text-ink"><ArrowUpRightIcon size={18} /></span></span>
                      <span className="mt-1 font-mono text-[12px] text-ink-3">{r.by}</span>
                      <span className="mt-3 text-[15px] leading-snug text-ink-2">{r.blurb}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-20" aria-labelledby="cheat">
          <h2 id="cheat" className="text-[clamp(30px,4vw,48px)]">Git cheat sheet</h2>
          <p className="mb-8 mt-3 max-w-[60ch] text-[17px] text-ink-2">The commands you&apos;ll use every day. Search, then press the copy button.</p>
          <CheatSheet />
        </section>

        <div className="mt-20 rounded-[18px] border-2 border-ink bg-[#dafbe1] p-6 sm:flex sm:items-center sm:justify-between sm:p-8">
          <p className="max-w-[56ch] text-[18px]"><b>Ready to try it for real?</b> Our workshops start from zero, and the <Link href="/contribute" className="font-semibold text-link underline">contribute page</Link> shows beginner-friendly issues you can fix today.</p>
          <Link href="/#join" className="press mt-4 inline-flex rounded-md bg-ink px-5 py-3 font-display font-bold text-white sm:mt-0">Join the club</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
