import { createHmac } from "node:crypto";
import { serverDb } from "./supabase-server";

/* A small per-server-instance limiter: `limit` hits per `windowMs` for each key (an IP address).
   Good enough to stop a script hammering a form; the database's own constraints are the real backstop. */
const buckets = new Map<string, number[]>();

export function limited(key: string, limit = 5, windowMs = 600_000, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now); buckets.set(key, recent);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k); // keep memory bounded
  return recent.length > limit;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

/* The visitor's key for the shared counter: a keyed SHA-256 of the form and the IP, so the database never
   sees or stores an IP. RATE_LIMIT_SALT is optional; without it a server-only secret we already have is used. */
export function visitorKey(scope: string, ip: string, salt = process.env.RATE_LIMIT_SALT || process.env.EMAIL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "ghblr") {
  return `${scope}:${createHmac("sha256", salt).update(`${scope}|${ip}`).digest("base64url")}`;
}

/* Every public form uses this. With Supabase connected the count lives in the database (rate_hit in
   supabase/schema.sql, which only the server key may call), so it holds across all of Vercel's server instances
   and restarts. If the database isn't connected, refuses the call, is missing the function or doesn't answer within
   1.5 s, the per-instance limiter takes over: a slow database must never block a sign-up. */
export async function rateLimited(req: Request, scope: string, limit = 5, windowMs = 600_000): Promise<boolean> {
  return keyLimited(scope, clientIp(req), limit, windowMs);
}

/** The same counter for any key, not just the visitor's IP: e.g. an email address, so one address can't be sent a pile
    of sign-in codes from many devices. The key is hashed the same way, so the database never stores it either. */
export async function keyLimited(scope: string, key: string, limit = 5, windowMs = 600_000): Promise<boolean> {
  const db = serverDb();
  if (db) {
    try {
      const { data, error } = await db
        .rpc("rate_hit", { p_key: visitorKey(scope, key), p_limit: limit, p_window_seconds: Math.round(windowMs / 1000) })
        .abortSignal(AbortSignal.timeout(1500));
      if (!error && typeof data === "boolean") return !data;
    } catch { /* fall back below */ }
  }
  return limited(`${scope}:${key}`, limit, windowMs);
}
