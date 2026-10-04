"use client";
import { usePathname } from "next/navigation";

/** The kiosk is the whole screen: no header, tab bar or footer around it. */
export const isKiosk = (path: string | null) => !!path?.startsWith("/epoch/kiosk/");
export function NotOnKiosk({ children }: { children: React.ReactNode }) {
  return isKiosk(usePathname()) ? null : <>{children}</>;
}
