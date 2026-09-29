import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Mona_Sans } from "next/font/google";
import { SmoothScroll } from "@/components/ui/SmoothScroll";
import { SITE_URL as SITE } from "@/lib/site";
import "./globals.css";

// GitHub's own open-source typeface (SIL OFL). The width axis gives the wide headline cut.
const mona = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-mona", display: "swap" });
const jbm = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbm" });


export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "GitHub Community Club · GITAM Bengaluru", template: "%s · GitHub Community Club BLR" },
  description: "The GitHub Community Club at GITAM University Bengaluru. Workshops, open source and Epoch, our flagship technical event.",
  openGraph: { title: "GitHub Community Club · GITAM Bengaluru", description: "Learn. Build. Merge. Six events this year and one flagship: Epoch.", type: "website", siteName: "GitHub Community Club BLR" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${mona.variable} ${jbm.variable}`}>
      <body className="min-h-screen antialiased">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
