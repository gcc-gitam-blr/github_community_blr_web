"use client";
import { useEffect } from "react";
import { MAX_PER_PAGE, scrub, worthReporting } from "@/lib/client-errors";

/* Tells the club when the site breaks on someone's phone, without a third-party service: uncaught errors go to
   /api/errors (admins see them on /admin). Each message once per page view, at most three, cleaned of emails and
   query strings before it leaves the browser. Production only; in development the error overlay shows them. */
export function ErrorReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const seen = new Set<string>();
    const send = (message: string, stack?: string) => {
      message = scrub(message, 300);
      if (seen.size >= MAX_PER_PAGE || seen.has(message) || !worthReporting(message, stack)) return;
      seen.add(message);
      const body = JSON.stringify({ message, stack: stack && scrub(stack, 2000), path: location.pathname });
      try { if (!navigator.sendBeacon?.("/api/errors", body)) void fetch("/api/errors", { method: "POST", body, keepalive: true }).catch(() => {}); } catch { /* reporting must never break the page */ }
    };
    const onError = (e: ErrorEvent) => send(e.message || String(e.error), e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => { const r = e.reason; send(r instanceof Error ? `${r.name}: ${r.message}` : `Unhandled rejection: ${typeof r === "string" ? r : Object.prototype.toString.call(r)}`, r?.stack); };
    addEventListener("error", onError); addEventListener("unhandledrejection", onRejection);
    return () => { removeEventListener("error", onError); removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
