import type { Metadata } from "next";
import { LeaderboardPage } from "@/components/epoch/Lists";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";

export const metadata: Metadata = { title: "Leaderboard", description: "Top earners at Epoch, ranked by coins earned at recharge points and prizes." };
const jsonLd = breadcrumbJsonLd([{ name: "Epoch", path: "/epoch" }, { name: "Leaderboard", path: "/epoch/leaderboard" }]);

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LeaderboardPage />
    </>
  );
}
