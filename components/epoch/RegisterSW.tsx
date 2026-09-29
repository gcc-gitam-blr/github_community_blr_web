"use client";
import { useEffect } from "react";

/* Registers the offline cache (public/sw.js) — production only, so development never serves stale files. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* offline support is a bonus, never an error */ });
  }, []);
  return null;
}
