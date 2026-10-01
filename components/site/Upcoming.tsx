"use client";
import { todayISO, useClientValue } from "@/lib/useClientValue";

/** Shows its children only while an event is still ahead (on its day, or any time before it).
    Used for "RSVP" buttons, which make no sense afterwards. Before the date is known (first paint) it shows them. */
export function Upcoming({ date, children }: { date: string; children: React.ReactNode }) {
  const today = useClientValue(todayISO, "");
  return today && date < today ? null : <>{children}</>;
}
