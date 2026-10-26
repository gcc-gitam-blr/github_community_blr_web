import type { Metadata } from "next";
import { ShopPage } from "@/components/epoch/Lists";

export const metadata: Metadata = { title: "Shop", description: "Spend your Epoch coins on merch, in coins." };

export default function Page() {
  return <ShopPage />;
}
