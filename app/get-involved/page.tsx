import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ContactForm } from "@/components/site/ContactForm";
import { Sticker } from "@/components/ui/Sticker";
import { CLUB } from "@/lib/config";
import { KINDS, type Kind } from "@/lib/contact";

export const metadata: Metadata = { title: "Get involved", description: "Join the core team, sponsor or partner with the club, speak at a session, or ask us anything." };

export default async function GetInvolved({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const initial = (KINDS.find((k) => k.id === kind)?.id ?? "question") as Kind;
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-[130px] md:px-[clamp(20px,5vw,72px)]">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div className="lg:sticky lg:top-28">
            <p className="font-mono text-[13px] text-ink-2">{"// get involved"}</p>
            <h1 className="mt-4 text-[clamp(40px,6vw,76px)]">Build the club<br />with us.</h1>
            <p className="mt-5 max-w-[46ch] text-[19px] text-ink-2">The club is run by students and grows with whoever shows up. Tell us how you&apos;d like to help — or just say hello.</p>
            <ul className="mt-8 space-y-3 text-[16px] text-ink-2">
              <li><b className="text-ink">Core team</b> — a few hours a week, real responsibility, great for your portfolio.</li>
              <li><b className="text-ink">Sponsors &amp; partners</b> — reach hundreds of student developers at Epoch and our sessions.</li>
              <li><b className="text-ink">Speakers</b> — share what you know with people who want to learn it.</li>
            </ul>
            {CLUB.joinUrl && <a href={CLUB.joinUrl} target="_blank" rel="noopener" className="mt-8 inline-block font-semibold text-link hover:underline">Prefer chat? Join our WhatsApp community →</a>}
            <Sticker name="mentor" size={160} tilt={-5} className="mt-8 hidden lg:block" alt="" />
          </div>
          <ContactForm initial={initial} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
