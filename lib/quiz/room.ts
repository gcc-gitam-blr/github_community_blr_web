"use client";
import type { QuizQuestion } from "./parse";

/* A live quiz room. The host's browser runs the game: it keeps the questions, the answers and the scores,
   and broadcasts what everyone should see. Phones only listen, and send their answer back.

   Two channels per room, so a hundred answers don't get copied to a hundred phones:
     quiz-<code>     host → everyone (subscribed by phones)
     quiz-<code>-in  phones → host (only the host subscribes; phones post to it over REST)

   With Supabase connected this runs over Realtime broadcast — no tables, nothing stored.
   Without it, the room is a BroadcastChannel: tabs of this browser only, for trying it out. */

export type Phase = "lobby" | "question" | "reveal" | "board" | "end";
/** score, rank (1-based), points gained this round, 1 right · 0 wrong · -1 no answer, streak */
export type Result = [number, number, number, number, number];
export type RoomState = {
  phase: Phase; title: string; index: number; total: number; seq: number;
  question?: Omit<QuizQuestion, "answer">; remaining?: number; // ms left when sent: phones count down from their own clock
  answer?: number; counts?: number[];
  results: Record<string, Result>;
  people: Record<string, [string, string]>; // id → [name, sticker], so phones can show who else is here
};
export type Msg =
  | { t: "state"; state: RoomState }
  | { t: "hello"; id: string; name: string; sticker?: string }
  | { t: "answer"; id: string; index: number; choice: number };

export interface Room {
  live: boolean;
  send(m: Msg): void;
  close(): void;
}

const ALPHABET = "0123456789abcdef";
/** A room code that looks like a short commit SHA. */
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % 16]).join("");
export const cleanCode = (s: string) => s.toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 6);

export const hasRealtime = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Kahoot-style: a right answer is worth 500–1000 by speed, plus 50 a question for a streak (up to 250). */
export const points = (elapsed: number, time: number, streak: number) =>
  Math.round(1000 * (1 - Math.min(1, Math.max(0, elapsed / (time * 1000))) / 2)) + Math.min(streak - 1, 5) * 50;

/** `role` decides which side of the room this browser is: the host hears the inbox, phones hear the host. */
export async function openRoom(code: string, role: "host" | "player", onMsg: (m: Msg) => void, onStatus?: (live: boolean) => void): Promise<Room> {
  const out = `quiz-${code}`, inbox = `quiz-${code}-in`;

  if (!hasRealtime) {
    const hear = new BroadcastChannel(role === "host" ? inbox : out);
    const say = new BroadcastChannel(role === "host" ? out : inbox);
    hear.onmessage = (e) => onMsg(e.data as Msg);
    queueMicrotask(() => onStatus?.(true));
    return { live: false, send: (m) => say.postMessage(m), close: () => { hear.close(); say.close(); } };
  }

  // A client of its own: Supabase keeps one channel per name per client, so a screen that mounts twice
  // (or reopens the same room) would otherwise get the old, closing channel back. No login needed here.
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `quiz-${role}` },
  });
  const opts = { config: { broadcast: { self: false, ack: false } } };
  sb.channel(role === "host" ? inbox : out, opts)
    .on("broadcast", { event: "m" }, ({ payload }) => onMsg(payload as Msg))
    .subscribe((s) => onStatus?.(s === "SUBSCRIBED"));
  // the host talks on the channel phones are subscribed to; phones post to the inbox without joining it
  const say = role === "host" ? sb.channel(out, opts).subscribe() : sb.channel(inbox, opts);
  return {
    live: true,
    send: (m) => {
      if (role === "host") void say.send({ type: "broadcast", event: "m", payload: m });
      else void say.httpSend("m", m).catch(() => { /* the phone retries its hello; an answer shows as not sent */ });
    },
    close: () => { void sb.removeAllChannels().then(() => sb.realtime.disconnect()); },
  };
}

/** Each player gets an Octodex sticker, the same one every time for the same id. */
export const STICKERS = ["octocat", "coder", "jetpack", "maker", "professor", "riveter", "skate", "adventure", "waldo", "pop", "cherry", "founder", "mentor", "heart", "swag", "support"] as const;
export type StickerId = (typeof STICKERS)[number];
export const isSticker = (s: unknown): s is StickerId => STICKERS.includes(s as StickerId);
export const stickerFor = (id: string): StickerId => STICKERS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % STICKERS.length];
