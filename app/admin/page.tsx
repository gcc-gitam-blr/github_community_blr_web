import type { Metadata } from "next";
import { EpochProvider } from "@/components/epoch/EpochProvider";
import { AdminApp } from "@/components/admin/AdminApp";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/* The club's admin dashboard: sign-ups, messages, feedback, attendance & certificates, and who has access. */
export default function AdminPage() {
  return <EpochProvider><AdminApp /></EpochProvider>;
}
