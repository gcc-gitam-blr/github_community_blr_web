import type { Metadata } from "next";
import { BoothsPage } from "@/components/epoch/Lists";

export const metadata: Metadata = { title: "Booths", description: "Where Epoch coins go: recharge points earn, everything else spends." };

export default function Page() {
  return <BoothsPage />;
}
