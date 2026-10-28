import type { Metadata } from "next";
import { BoothsPage } from "@/components/epoch/Lists";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";

export const metadata: Metadata = { title: "Booths", description: "Where Epoch coins go: recharge points earn, everything else spends." };
const jsonLd = breadcrumbJsonLd([{ name: "Epoch", path: "/epoch" }, { name: "Booths", path: "/epoch/booths" }]);

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BoothsPage />
    </>
  );
}
