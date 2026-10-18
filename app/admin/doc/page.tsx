import type { Metadata } from "next";
import { OfficialDoc } from "@/components/admin/OfficialDoc";

export const metadata: Metadata = { title: "Document", robots: { index: false, follow: false } };

/* An event proposal or the minutes of a meeting, in the university's format, to save as a PDF: /admin/doc?proposal=12 or ?minutes=3. */
export default function DocPage() {
  return <OfficialDoc />;
}
