import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { About, Events, Faq, Join, Learn, Projects, Team } from "@/components/site/Sections";
import { SiteFooter } from "@/components/site/SiteFooter";

export default function Home() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-white">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <About />
        <Learn />
        <Events />
        <Projects />
        <Team />
        <Faq />
        <Join />
      </main>
      <SiteFooter />
    </>
  );
}
