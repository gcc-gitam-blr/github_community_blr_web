import type { MetadataRoute } from "next";

import { SITE_URL as SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/epoch", "/epoch/booths", "/epoch/shop", "/epoch/leaderboard", "/epoch/register"].map((p) => ({ url: SITE + p, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
