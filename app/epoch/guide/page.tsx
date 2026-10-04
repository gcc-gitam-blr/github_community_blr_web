import type { Metadata } from "next";
import { AttendeeGuide } from "@/components/epoch/Guide";

export const metadata: Metadata = { title: "Epoch guide", description: "How Epoch works on the day: the desk, coins, booths, receipts and help. One page, printable." };

export default function Page() {
  return <AttendeeGuide />;
}
