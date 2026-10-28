import type { Metadata } from "next";
import { AttendeeGuide } from "@/components/epoch/Guide";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";

export const metadata: Metadata = { title: "Epoch guide", description: "How Epoch works on the day: the desk, coins, booths, receipts and help. One page, printable." };
const jsonLd = breadcrumbJsonLd([{ name: "Epoch", path: "/epoch" }, { name: "Guide", path: "/epoch/guide" }]);

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <AttendeeGuide />
    </>
  );
}
