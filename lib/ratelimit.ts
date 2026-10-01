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
