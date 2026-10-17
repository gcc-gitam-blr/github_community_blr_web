import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ProjectHub } from "@/components/hub/ProjectHub";
import { Sticker } from "@/components/ui/Sticker";

export const metadata: Metadata = { title: "Project hub", description: "Tell us what you'd like to build, find a project that needs you, or find people with the skills you're missing.", robots: { index: false, follow: false } };

export default function HubPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1100px] px-5 pb-24 pt-[130px] md:px-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[13px] text-ink-2">{"// git checkout -b our-next-project"}</p>
            <h1 className="mt-4 text-[clamp(40px,6.4vw,76px)]">Build something together.</h1>
            <p className="mt-5 max-w-[56ch] text-[19px] text-ink-2">Say what you like, share an idea, and find the people who can build it with you. The best of what we make goes on the <a href="/projects" className="underline underline-offset-4">projects page</a>.</p>
          </div>
          <Sticker name="maker" size={150} tilt={5} className="mb-2 hidden md:block" alt="" />
        </div>
        <ProjectHub />
      </main>
      <SiteFooter />
    </>
  );
}
