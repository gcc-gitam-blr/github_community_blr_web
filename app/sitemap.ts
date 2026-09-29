import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/epoch", "/epoch/booths", "/epoch/shop", "/epoch/leaderboard", "/epoch/register"].map((p) => ({ url: SITE + p, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
