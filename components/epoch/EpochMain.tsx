"use client";
import { usePathname } from "next/navigation";

/** Leaves room for the dashboard rail on app screens; the landing page is full-bleed. */
export function EpochMain({ children }: { children: React.ReactNode }) {
  const landing = usePathname() === "/epoch";
  return <main className={`relative z-10 ${landing ? "" : "lg:pl-[224px]"}`}>{children}</main>;
}
