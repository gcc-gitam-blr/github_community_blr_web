import type { Metadata } from "next";
import { Register } from "@/components/epoch/Register";

export const metadata: Metadata = { title: "Register", description: "Get your Epoch wallet — name, email and the code we send. No GitHub account needed." };

export default function Page() {
  return <Register />;
}
