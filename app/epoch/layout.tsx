import type { Metadata } from "next";
import { EpochProvider } from "@/components/epoch/EpochProvider";
import { EpochNav } from "@/components/epoch/EpochNav";
import { EpochEntrance } from "@/components/epoch/EpochEntrance";

export const metadata: Metadata = {
  title: "EPOCH'26 — The tech fest where every commit counts",
  description: "Register, collect Epoch Coins, scan stall QR codes, climb the leaderboard and spend your coins on rewards.",
};

export default function EpochLayout({ children }: { children: React.ReactNode }) {
  return (
    <EpochProvider>
      <div className="min-h-screen bg-white">
        <EpochNav />
        <main>{children}</main>
      </div>
      <EpochEntrance />
    </EpochProvider>
  );
}
