import type { Metadata } from "next";
import { EpochProvider } from "@/components/epoch/EpochProvider";
import { EpochNav } from "@/components/epoch/EpochNav";
import { EpochEntrance } from "@/components/epoch/EpochEntrance";

export const metadata: Metadata = {
  title: "epoch_26 — GITAM Bengaluru's GitHub tech fest",
  description: "Two days of workshops, competitions and 20+ booths on one economy: Epoch Coins. Get your ticket, recharge, spend, climb the board.",
};

export default function EpochLayout({ children }: { children: React.ReactNode }) {
  return (
    <EpochProvider>
      <div className="min-h-screen bg-night pb-28 text-white md:pb-0 print:bg-white print:text-black">
        <EpochNav />
        <main>{children}</main>
      </div>
      <EpochEntrance />
    </EpochProvider>
  );
}
