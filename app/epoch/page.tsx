import type { Metadata } from "next";
import { EpochHome } from "@/components/epoch/Home";

export const metadata: Metadata = { title: "Epoch", description: "Two days. One economy. Every commit counts. GITAM Bengaluru's flagship technical fest — workshops, booths, a coin economy and a leaderboard." };

export default function EpochPage() {
  return <EpochHome />;
}
