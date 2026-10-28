import type { Metadata } from "next";
import { Register } from "@/components/epoch/Register";
import { breadcrumbJsonLd } from "@/lib/breadcrumb";

export const metadata: Metadata = { title: "Get your ticket", description: "Get your Epoch wallet — name, email and the code we send. No GitHub account needed." };
const jsonLd = breadcrumbJsonLd([{ name: "Epoch", path: "/epoch" }, { name: "Register", path: "/epoch/register" }]);

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Register />
    </>
  );
}
