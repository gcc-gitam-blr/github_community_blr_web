import type { MetadataRoute } from "next";

import { SITE_URL as SITE } from "@/lib/site";
import { EVENTS, eventSlug } from "@/lib/events";
import { getUpdates } from "@/lib/updates";
import { MEMORIES_LINKED } from "@/lib/memories";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/learn", "/contribute", "/board", "/get-involved", "/updates", ...(MEMORIES_LINKED ? ["/memories"] : []), ...getUpdates().map((u) => `/updates/${u.slug}`), ...EVENTS.map((e) => `/events/${eventSlug(e)}`), "/epoch", "/epoch/booths", "/epoch/shop", "/epoch/leaderboard", "/epoch/register", "/epoch/guide"].map((p) => ({ url: SITE + p, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
