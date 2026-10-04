import type { Metadata } from "next";
import { BigScreen } from "@/components/epoch/BigScreen";

export const metadata: Metadata = { title: "Big screen", robots: { index: false, follow: false } };

export default function Page() {
  return <BigScreen />;
}
