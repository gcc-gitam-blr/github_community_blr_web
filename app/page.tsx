import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { About, Events, Faq, Join, Learn, Projects } from "@/components/site/Sections";
import { Team } from "@/components/site/Team";
import { SiteFooter } from "@/components/site/SiteFooter";
import { WhatIsGitHub } from "@/components/site/WhatIsGitHub";
import { Gallery } from "@/components/site/Gallery";
import { CLUB } from "@/lib/config";
import { SITE_URL } from "@/lib/site";

export default function Home() {
  // schema.org Organization + WebSite — the club's canonical identity for search and AI answers.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization", "@id": `${SITE_URL}/#org`, name: CLUB.name, url: SITE_URL, logo: `${SITE_URL}/brand/club-mark.png`, email: CLUB.email || undefined,
        // WhatsApp is a join link, not a profile page, so it's left out here
        sameAs: [...(CLUB.githubOrg ? [`${CLUB.githubUrl}/${CLUB.githubOrg}`] : []), ...CLUB.socials.filter((s) => s.label !== "WhatsApp").map((s) => s.href)],
        parentOrganization: { "@type": "CollegeOrUniversity", name: CLUB.university },
      },
      { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: SITE_URL, name: CLUB.name, publisher: { "@id": `${SITE_URL}/#org` } },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a href="#main" className="press sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-white">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <WhatIsGitHub />
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
