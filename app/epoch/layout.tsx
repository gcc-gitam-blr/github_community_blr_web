import type { Metadata } from "next";
import { EpochProvider } from "@/components/epoch/EpochProvider";
import { CommandProvider } from "@/components/epoch/Command";
import { EpochNav } from "@/components/epoch/EpochNav";
import { EpochEntrance } from "@/components/epoch/EpochEntrance";
import { EpochMain } from "@/components/epoch/EpochMain";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  title: "epoch — GITAM Bengaluru's GitHub tech fest",
  description: "Two days of workshops, competitions and 20+ booths on one currency: Epoch Coins.",
  icons: { icon: "/epoch-coin.svg" },
};

/* Oddval Medium is a licensed font. If you add it to /public/fonts the browser picks it up;
   otherwise the request 404s quietly and Instrument Sans (the fallback) is used. */
const OddvalFace = `
@font-face { font-family: "Oddval"; font-weight: 400 600; font-display: swap;
  src: url("/fonts/Oddval-Medium.woff2") format("woff2"), url("/fonts/Oddval-Medium.otf") format("opentype"), url("/fonts/Oddval-Medium.ttf") format("truetype"); }`;

export default function EpochLayout({ children }: { children: React.ReactNode }) {
  return (
    <EpochProvider>
      <CommandProvider>
        <style dangerouslySetInnerHTML={{ __html: OddvalFace }} />
        <div className="epoch-field flex min-h-screen flex-col font-epoch text-ink print:bg-white">
          <EpochNav />
          <EpochMain>{children}</EpochMain>
          <div className="relative z-10 no-print font-sans"><SiteFooter sticker={false} /></div>
          <div aria-hidden className="h-24 bg-[#010409] md:hidden" />{/* room for the phone tab bar */}
        </div>
        <EpochEntrance />
      </CommandProvider>
    </EpochProvider>
  );
}
