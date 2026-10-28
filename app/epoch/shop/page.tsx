import type { Metadata } from "next";
import { ShopPage } from "@/components/epoch/Lists";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";

export const metadata: Metadata = { title: "Shop", description: "Spend your Epoch coins on merch, in coins." };
const jsonLd = breadcrumbJsonLd([{ name: "Epoch", path: "/epoch" }, { name: "Shop", path: "/epoch/shop" }]);

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ShopPage />
    </>
  );
}
