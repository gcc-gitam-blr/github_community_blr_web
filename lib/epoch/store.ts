import { localStore } from "./local-store";
import type { EpochStore } from "./types";

/* Picks the backend. With NEXT_PUBLIC_SUPABASE_URL + _ANON_KEY set the fest runs
   on Supabase (shared across every attendee's phone); otherwise it falls back to
   the single-browser demo store. */
export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let cached: EpochStore | null = null;

export async function getStore(): Promise<EpochStore> {
  if (cached) return cached;
  if (hasSupabase) {
    const { supabaseStore } = await import("./supabase-store");
    cached = supabaseStore;
  } else {
    cached = localStore;
  }
  return cached;
}

/** QR payloads: `epoch:u:<userId>` for wallets, `epoch:b:<boothId>` for booths. */
export const qr = {
  user: (id: string) => `epoch:u:${id}`,
  booth: (id: string) => `epoch:b:${id}`,
  parse(text: string): { kind: "user" | "booth"; id: string } | null {
    const m = /^epoch:(u|b):(.+)$/.exec(text.trim());
    return m ? { kind: m[1] === "u" ? "user" : "booth", id: m[2] } : null;
  },
};
