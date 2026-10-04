import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Mona_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ErrorReporter } from "@/components/ui/ErrorReporter";
import { SmoothScroll } from "@/components/ui/SmoothScroll";
import { THEME_SCRIPT } from "@/lib/theme";
import { SITE_URL as SITE } from "@/lib/site";
import "./globals.css";

// GitHub's own open-source typeface (SIL OFL). The width axis gives the wide headline cut.
const mona = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-mona", display: "swap" });
const jbm = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbm" });


// Vercel Web Analytics + Speed Insights: cookie-free. Enable them in the Vercel dashboard, then set NEXT_PUBLIC_ANALYTICS=on.
const ANALYTICS = process.env.NEXT_PUBLIC_ANALYTICS === "on";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "GitHub Community Club · GITAM Bengaluru", template: "%s · GitHub Community Club BLR" },
  description: "The GitHub Community Club at GITAM University Bengaluru. Workshops, open source and Epoch, our flagship technical event.",
  openGraph: { title: "GitHub Community Club · GITAM Bengaluru", description: "Code. Collaborate. Contribute. Learn Git & GitHub, open source and hands-on workshops at GITAM Bengaluru.", type: "website", siteName: "GitHub Community Club BLR" },
  twitter: { card: "summary_large_image" },
  icons: { icon: [{ url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" }], apple: "/brand/apple-touch.png" }, // the club logo (scripts/brand.mjs)
};
export const viewport: Viewport = { themeColor: "#ffffff", viewportFit: "cover" }; // cover: lets fixed bars use env(safe-area-inset-*)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets data-theme on <html> before React loads
    <html lang="en" data-scroll-behavior="smooth" className={`${mona.variable} ${jbm.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen antialiased">
        <noscript><style>{".reveal,.reveal-group .stagger>*,.reveal-group .pop{opacity:1!important;transform:none!important;scale:1!important}.reveal-group .draw{transform:none!important}.reveal-group .print-in{opacity:1!important;translate:none!important;scale:none!important}"}</style></noscript>
        <SmoothScroll />
        <ErrorReporter />
        {children}
        {ANALYTICS && <><Analytics /><SpeedInsights /></>}
      </body>
    </html>
  );
}
