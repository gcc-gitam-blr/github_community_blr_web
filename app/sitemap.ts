import type { MetadataRoute } from "next";

import { SITE_URL as SITE } from "@/lib/site";
import { EVENTS, eventSlug } from "@/lib/events";
import { getUpdates } from "@/lib/updates";
import { MEMORIES_LINKED } from "@/lib/memories";

export default function sitemap(): MetadataRoute.Sitemap {
  const updates = getUpdates();
  const staticPaths = ["", "/privacy", "/learn", "/contribute", "/board", "/get-involved", "/join", "/apply", "/updates", ...(MEMORIES_LINKED ? ["/memories"] : []), ...EVENTS.map((e) => `/events/${eventSlug(e)}`), "/epoch", "/epoch/booths", "/epoch/shop", "/epoch/leaderboard", "/epoch/register", "/epoch/guide"];
  return [
    ...staticPaths.map((p) => ({ url: SITE + p, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    // the only pages with a real, known last-modified date: their own published date
    ...updates.map((u) => ({ url: `${SITE}/updates/${u.slug}`, lastModified: u.date, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
