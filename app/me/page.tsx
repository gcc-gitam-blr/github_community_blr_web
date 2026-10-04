import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { MyClub } from "@/components/site/MyClub";
import { Sticker } from "@/components/ui/Sticker";

export const metadata: Metadata = { title: "My club", description: "Your events, certificates, merges and badges.", robots: { index: false, follow: false } };

export default function MePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1040px] px-5 pb-24 pt-[130px] md:px-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[13px] text-ink-2">{"// git log --author=me"}</p>
            <h1 className="mt-4 text-[clamp(40px,6.4vw,76px)]">My club.</h1>
          </div>
          <Sticker name="founder" size={130} tilt={6} className="mb-2 hidden md:block" alt="" />
        </div>
        <MyClub />
      </main>
      <SiteFooter />
    </>
  );
}
