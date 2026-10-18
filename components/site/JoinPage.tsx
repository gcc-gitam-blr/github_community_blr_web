"use client";
import { useClientValue } from "@/lib/useClientValue";
import { JoinExtras, JoinForm, JoinedPanel, useJoined } from "./QuickJoin";

/* /join: the link in the welcome email (?e=&t=) opens the optional extras for that sign-up; without it, the page is a
   focused way to join (a good QR code for posters and the first slide of a session). */
export function JoinPage() {
  const link = useClientValue(() => { const q = new URLSearchParams(location.search); return q.get("e") && q.get("t") ? `${q.get("e")}|${q.get("t")}` : ""; }, null);
  const [joined] = useJoined();
  if (link === null) return <div className="h-40" aria-busy="true" />;
  if (link) {
    const [email, token] = link.split("|");
    const fromBrowser = joined?.email === email ? joined : null;
    if (fromBrowser?.extras === "done") return <JoinedPanel joined={fromBrowser} />;
    return <JoinExtras joined={{ name: fromBrowser?.name ?? "", email, token }} />;
  }
  return joined ? <JoinedPanel joined={joined} /> : <JoinForm tone="card" />;
}
