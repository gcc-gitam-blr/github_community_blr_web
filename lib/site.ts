/* The site's public address, for share previews, the sitemap and robots.txt.
   An explicit NEXT_PUBLIC_SITE_URL wins; otherwise Vercel tells every build its production domain. */
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
