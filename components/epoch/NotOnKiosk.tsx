"use client";
import { usePathname } from "next/navigation";

/** The booth kiosks and the big screen are the whole screen: no header, tab bar or footer around them. */
export const isKiosk = (path: string | null) => !!path && (path.startsWith("/epoch/kiosk/") || path === "/epoch/screen");
export function NotOnKiosk({ children }: { children: React.ReactNode }) {
  return isKiosk(usePathname()) ? null : <>{children}</>;
}
