import { createHmac, timingSafeEqual } from "node:crypto";

/* Signed links, so nobody can unsubscribe someone else by guessing an address.
   token = HMAC-SHA256(secret, email) — the secret never leaves the server. */
const secret = () => process.env.EMAIL_SECRET || process.env.SMTP_PASS || process.env.RESEND_API_KEY || "";

export const tokenFor = (email: string, key = secret()) => createHmac("sha256", key).update(email.trim().toLowerCase()).digest("hex").slice(0, 32);

export function verifyToken(email: string, token: string, key = secret()): boolean {
  if (!key || !token) return false;
  const a = Buffer.from(tokenFor(email, key)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const unsubscribeUrl = (site: string, email: string) => `${site}/unsubscribe?e=${encodeURIComponent(email.trim().toLowerCase())}&t=${tokenFor(email)}`;

/** The machine-readable endpoint that mail apps use for one-click unsubscribe. */
export const unsubscribeApiUrl = (site: string, email: string) => `${site}/api/unsubscribe?e=${encodeURIComponent(email.trim().toLowerCase())}&t=${tokenFor(email)}`;
