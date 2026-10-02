import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { About, Events, Faq, Join, Learn, Projects } from "@/components/site/Sections";
import { Team } from "@/components/site/Team";
import { SiteFooter } from "@/components/site/SiteFooter";
import { WhatIsGitHub } from "@/components/site/WhatIsGitHub";
import { GitHubChangelog } from "@/components/site/GitHubChangelog";
import { Gallery } from "@/components/site/Gallery";

export default function Home() {
  return (
    <>
      <a href="#main" className="press sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-white">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <WhatIsGitHub />
        <GitHubChangelog variant="home" />
        <About />
        <Learn />
        <Events />
        <Gallery />
        <Projects />
        <Team />
        <Faq />
        <Join />
      </main>
      <SiteFooter />
    </>
  );
}
