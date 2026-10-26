import type { Metadata } from "next";
import { LeaderboardPage } from "@/components/epoch/Lists";

export const metadata: Metadata = { title: "Leaderboard", description: "Top earners at Epoch, ranked by coins earned at recharge points and prizes." };

export default function Page() {
  return <LeaderboardPage />;
}
