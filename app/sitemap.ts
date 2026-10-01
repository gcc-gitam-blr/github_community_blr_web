import type { MetadataRoute } from "next";

import { SITE_URL as SITE } from "@/lib/site";
import { EVENTS, eventSlug } from "@/lib/events";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/learn", "/contribute", "/get-involved", ...EVENTS.map((e) => `/events/${eventSlug(e)}`), "/epoch", "/epoch/booths", "/epoch/shop", "/epoch/leaderboard", "/epoch/register"].map((p) => ({ url: SITE + p, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
