"use client";
import { usePathname } from "next/navigation";
import { isKiosk } from "./NotOnKiosk";

/** Leaves room for the dashboard rail on app screens (desktop) and the fixed phone tab bar (mobile);
    the landing page skips only the rail padding, since the tab bar is fixed and shows on every /epoch/* page. */
export function EpochMain({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const kiosk = isKiosk(path); const landing = path === "/epoch" || kiosk;
  return <main className={`relative z-10 flex-1 ${landing ? "" : "lg:pl-[224px]"} ${kiosk ? "" : "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0"}`}>{children}</main>;
}
