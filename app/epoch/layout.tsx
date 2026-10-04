import fs from "node:fs";
import path from "node:path";
import type { Metadata, Viewport } from "next";
import { EpochProvider } from "@/components/epoch/EpochProvider";
import { CommandProvider } from "@/components/epoch/Command";
import { EpochNav } from "@/components/epoch/EpochNav";
import { EpochEntrance } from "@/components/epoch/EpochEntrance";
import { EpochMain } from "@/components/epoch/EpochMain";
import { SiteFooter } from "@/components/site/SiteFooter";
import { RegisterSW } from "@/components/epoch/RegisterSW";
import { NotOnKiosk } from "@/components/epoch/NotOnKiosk";

// the browser bar matches Epoch's paper instead of the club's white
export const viewport: Viewport = { themeColor: "#f4f1ea", viewportFit: "cover" };

export const metadata: Metadata = {
  title: "epoch — GITAM Bengaluru's GitHub tech fest",
  description: "Two days of workshops, competitions and 20+ booths on one currency: Epoch Coins.",
  icons: { icon: "/epoch-coin.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Epoch", statusBarStyle: "default" },
};

/* Oddval Medium is a licensed font. Drop it into /public/fonts and it's used automatically;
   the @font-face is only emitted for files that exist, so there are no 404s before then. */
const ODDVAL = ([["woff2", "woff2"], ["otf", "opentype"], ["ttf", "truetype"]] as const)
  .filter(([ext]) => fs.existsSync(path.join(process.cwd(), "public", "fonts", `Oddval-Medium.${ext}`)))
  .map(([ext, fmt]) => `url("/fonts/Oddval-Medium.${ext}") format("${fmt}")`);
const OddvalFace = ODDVAL.length ? `@font-face { font-family: "Oddval"; font-weight: 400 600; font-display: swap; src: ${ODDVAL.join(", ")}; }` : "";

export default function EpochLayout({ children }: { children: React.ReactNode }) {
  return (
    <EpochProvider>
      <CommandProvider>
        {OddvalFace && <style dangerouslySetInnerHTML={{ __html: OddvalFace }} />}
        <div data-light-only className="epoch-field flex min-h-screen flex-col font-epoch text-ink print:bg-white">
          <EpochNav />
          <EpochMain>{children}</EpochMain>
          <NotOnKiosk>
            <div className="relative z-10 no-print font-sans"><SiteFooter sticker={false} /></div>
            <div aria-hidden className="no-print h-[calc(6rem+env(safe-area-inset-bottom))] bg-[#010409] md:hidden" />{/* room for the phone tab bar */}
          </NotOnKiosk>
        </div>
        <EpochEntrance />
        <RegisterSW />
      </CommandProvider>
    </EpochProvider>
  );
}
