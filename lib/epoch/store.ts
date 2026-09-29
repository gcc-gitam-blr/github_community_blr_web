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

/** QR payloads: `epoch:u:<userId>` for wallets, `epoch:s:<stallId>` for stalls. */
export const qr = {
  user: (id: string) => `epoch:u:${id}`,
  stall: (id: string) => `epoch:s:${id}`,
  parse(text: string): { kind: "user" | "stall"; id: string } | null {
    const m = /^epoch:(u|s):(.+)$/.exec(text.trim());
    return m ? { kind: m[1] === "u" ? "user" : "stall", id: m[2] } : null;
  },
};
