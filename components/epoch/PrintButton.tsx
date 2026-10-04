"use client";
import { btnSoft } from "./Bits";

export function PrintButton({ children = "Print" }: { children?: React.ReactNode }) {
  return <button type="button" onClick={() => window.print()} className={`${btnSoft} no-print !py-3`}>{children}</button>;
}
