import type { MetadataRoute } from "next";

import { SITE_URL as SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // personal and organiser screens have nothing worth indexing
  return { rules: { userAgent: "*", allow: "/", disallow: ["/epoch/wallet", "/epoch/scan", "/epoch/admin", "/admin", "/certificates/"] }, sitemap: `${SITE}/sitemap.xml` };
}
