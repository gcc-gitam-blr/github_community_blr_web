import type { Metadata } from "next";
import { EpochHome } from "@/components/epoch/Home";
import { CLUB } from "@/lib/config";
import { findEvent } from "@/lib/events";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Epoch", description: "Two days. One economy. Every commit counts. GITAM Bengaluru's flagship technical fest — workshops, booths, a coin economy and a leaderboard." };

// the same event as /events/epoch-github-technical-month, but this is the page people actually search for ("Epoch GITAM Bengaluru")
const e = findEvent("epoch-github-technical-month");
const jsonLd = e && {
  "@context": "https://schema.org", "@type": "Event", name: e.title, description: e.text,
  startDate: e.dateLabel ? e.date.slice(0, 7) : e.date, ...(e.dateLabel ? {} : { endDate: e.date }),
  eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: { "@type": "Place", name: "GITAM University, Bengaluru", address: { "@type": "PostalAddress", addressLocality: "Bengaluru", addressRegion: "Karnataka", addressCountry: "IN" } },
  organizer: { "@type": "Organization", name: CLUB.name, url: SITE_URL }, url: `${SITE_URL}/epoch`,
  image: `${SITE_URL}/epoch/opengraph-image`, ...(e.luma ? { offers: { "@type": "Offer", url: e.luma, availability: "https://schema.org/InStock" } } : {}),
};

export default function EpochPage() {
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <EpochHome />
    </>
  );
}
