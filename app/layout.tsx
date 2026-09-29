import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-outfit" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jbm = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbm" });

export const metadata: Metadata = {
  title: "GitHub Community Club BLR — Learn. Build. Merge.",
  description: "The student developer community of our Bengaluru campus. Workshops, hackathons, open source — and Epoch, our annual fest.",
  openGraph: { title: "GitHub Community Club BLR", description: "Learn. Build. Merge.", type: "website" },
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable} ${jbm.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
