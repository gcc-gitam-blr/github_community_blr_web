import type { Metadata } from "next";
import { OrganiserGuide } from "@/components/epoch/Guide";

export const metadata: Metadata = { title: "Epoch organiser guide", description: "For Epoch volunteers and admins: desk check-in, cash, scanning, reversals, the kiosk and who to call.", robots: { index: false } };

export default function Page() {
  return <OrganiserGuide />;
}
