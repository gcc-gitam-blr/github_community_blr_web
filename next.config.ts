import path from "node:path";
import type { NextConfig } from "next";

/* Security headers. The Content-Security-Policy lists exactly what the site talks to:
   itself, Supabase (database + login), GitHub (avatars, username check) and Vercel's cookie-free analytics.
   Inline scripts/styles are allowed because Next.js and Tailwind emit them. Only applied in production,
   because the dev server needs eval for hot reload. */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://github.com https://avatars.githubusercontent.com https://*.githubusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.github.com https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const headers = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" }, // camera: the Epoch QR scanner
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // A stray package-lock.json in the parent folder made Next guess the wrong workspace root.
  turbopack: { root: path.resolve(__dirname) },
  async headers() {
    return process.env.NODE_ENV === "production" ? [{ source: "/:path*", headers }] : [];
  },
};

export default nextConfig;
