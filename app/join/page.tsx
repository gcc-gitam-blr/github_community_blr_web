import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JoinPage } from "@/components/site/JoinPage";
import { Sticker } from "@/components/ui/Sticker";

export const metadata: Metadata = { title: "Join the club", description: "Join the GitHub Community Club at GITAM Bengaluru: your name and email, nothing else. Free, and no experience needed." };

export default function Join() {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto w-full max-w-[1100px] px-5 pb-24 pt-[130px] md:px-[clamp(20px,5vw,72px)]">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="font-mono text-[13px] text-ink-2">{"// git checkout -b you"}</p>
            <h1 className="mt-4 text-[clamp(40px,6vw,72px)]">Your first<br />commit.</h1>
            <p className="mt-5 max-w-[42ch] text-[19px] text-ink-2">Your name and email, and you&apos;re in. We&apos;ll send what&apos;s next and the WhatsApp link. Your GitHub username can wait.</p>
            <ul className="mt-8 space-y-3 text-[16px] text-ink-2">
              <li><b className="text-ink">Free</b>, and every session starts from zero.</li>
              <li><b className="text-ink">Real contributions</b>: your first pull request, with people who&apos;ve done it before.</li>
              <li><b className="text-ink">Epoch</b> in December: the club&apos;s fest, with its own coins.</li>
            </ul>
            <Sticker name="welcome" size={150} tilt={-5} className="mt-8 hidden lg:block" alt="" />
          </div>
          <div className="rounded-[18px] border border-line bg-white p-6 shadow-[0_30px_80px_-30px_rgba(11,11,15,.25)] sm:p-8"><JoinPage /></div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
