import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ApplyForm } from "@/components/site/ApplyForm";
import { Sticker } from "@/components/ui/Sticker";

export const metadata: Metadata = { title: "Join the core team", description: "Apply to help run the GitHub Community Club: events, tech, design, content and outreach." };

/* The link to share when a recruitment round opens: the round's own form (built in Admin → Recruitment), or a note
   that applications are closed. */
export default function Apply() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-[130px] md:px-[clamp(20px,5vw,72px)]">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
          <div className="lg:sticky lg:top-28">
            <p className="font-mono text-[13px] text-ink-2">{"// apply"}</p>
            <h1 className="mt-4 text-[clamp(40px,6vw,72px)]">Join the<br />core team.</h1>
            <p className="mt-5 max-w-[44ch] text-[19px] text-ink-2">A few hours a week, real responsibility, and people who ship things together. No experience needed: tell us what you&apos;d like to do.</p>
            <ul className="mt-8 space-y-3 text-[16px] text-ink-2">
              <li><b className="text-ink">Apply</b>: the form takes about ten minutes.</li>
              <li><b className="text-ink">Hear back</b>: the reviewers read every application and reply by email.</li>
              <li><b className="text-ink">Start</b>: if you&apos;re selected, you join the next team meeting.</li>
            </ul>
            <Sticker name="maker" size={150} tilt={-5} className="mt-8 hidden lg:block" alt="" />
          </div>
          <div className="rounded-[18px] border border-line bg-white p-5 sm:p-8"><ApplyForm /></div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
