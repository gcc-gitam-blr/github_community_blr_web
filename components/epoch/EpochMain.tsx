"use client";
import { usePathname } from "next/navigation";
import { isKiosk } from "./NotOnKiosk";

/** Leaves room for the dashboard rail on app screens; the landing page is full-bleed. */
export function EpochMain({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const landing = path === "/epoch" || isKiosk(path);
  return <main className={`relative z-10 flex-1 ${landing ? "" : "lg:pl-[224px]"}`}>{children}</main>;
}
