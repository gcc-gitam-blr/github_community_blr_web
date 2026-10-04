"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getStore } from "./store";

/* The live leaderboard. Transactions are private, so phones never receive them: in live mode they listen to one
   public counter (leaderboard_version, see supabase/schema.sql) through Supabase Realtime, and re-read the public
   leaderboard when it moves. If Realtime can't connect, they ask every few seconds instead. In demo mode the
   board lives in this browser, so other tabs' changes arrive through the storage event. */

export type BoardRow = { id: string; handle: string; name: string; earned: number; gained: number; climbed: number };
/** live: changes arrive by themselves · polling: asking every few seconds · offline: the last fetch failed */
export type BoardLink = "connecting" | "live" | "polling" | "offline";

const SLOW_POLL = 60_000, FAST_POLL = 10_000, MIN_GAP = 2_000;

export function useLiveLeaderboard(limit = 20) {
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [link, setLink] = useState<BoardLink>("connecting");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true, busy = false, again = false, last = 0, realtime = false, demo = false;
    let timer: ReturnType<typeof setTimeout> | undefined, poll: ReturnType<typeof setInterval> | undefined;
    let prev: Map<string, { earned: number; rank: number }> | null = null;
    const cleanups: (() => void)[] = [];

    const fetchRows = async (): Promise<Omit<BoardRow, "gained" | "climbed">[]> => {
      const store = await getStore();
      demo = store.mode === "local";
      if (demo) return store.leaderboard(limit);
      // asked directly, so a network error keeps the last board on screen instead of emptying it
      const { supabase } = await import("./supabase-store");
      const { data, error } = await supabase().from("leaderboard").select("id, handle, name, earned").order("earned", { ascending: false }).order("handle").limit(limit);
      if (error) throw error;
      return data ?? [];
    };

    const load = async () => {
      if (busy) { again = true; return; }
      busy = true; last = Date.now();
      try {
        const got = await fetchRows();
        if (!alive) return;
        // what changed since the last look: coins gained, places climbed (nothing on the first load)
        const next = got.map((r, i) => { const p = prev?.get(r.id); return { ...r, gained: prev ? r.earned - (p?.earned ?? 0) : 0, climbed: prev ? (p ? p.rank - i : got.length - i) : 0 }; });
        prev = new Map(got.map((r, i) => [r.id, { earned: r.earned, rank: i }]));
        setRows(next); setUpdatedAt(Date.now()); setLink(demo || realtime ? "live" : "polling");
      } catch {
        if (alive) setLink("offline");
      } finally {
        busy = false;
        if (again && alive) { again = false; soon(); }
      }
    };
    // when hundreds of phones get the same nudge, a short random wait spreads their requests out
    const soon = (jitter = 0) => {
      if (timer || !alive) return;
      timer = setTimeout(() => { timer = undefined; void load(); }, Math.max(0, MIN_GAP - (Date.now() - last)) + Math.random() * jitter);
    };
    const every = (ms: number) => { clearInterval(poll); poll = setInterval(() => { if (document.visibilityState === "visible") soon(); }, ms); };

    const onVisible = () => { if (document.visibilityState === "visible") soon(); };
    const onOnline = () => soon();
    document.addEventListener("visibilitychange", onVisible); window.addEventListener("online", onOnline);
    cleanups.push(() => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onOnline); });

    void (async () => {
      await load();
      if (!alive) return;
      if (demo) {
        const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === "epoch:users") soon(); };
        window.addEventListener("storage", onStorage); cleanups.push(() => window.removeEventListener("storage", onStorage));
        return;
      }
      every(FAST_POLL); // until Realtime says it's connected
      const { supabase } = await import("./supabase-store");
      if (!alive) return;
      const sb = supabase();
      // a unique name: a page that mounts twice must not reuse a channel that's still closing
      const channel = sb.channel(`leaderboard-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leaderboard_version" }, () => soon(1500))
        .subscribe((status) => {
          if (!alive) return;
          if (status === "SUBSCRIBED") { realtime = true; every(SLOW_POLL); soon(); } // reconnected: catch up on anything missed
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { realtime = false; every(FAST_POLL); setLink((l) => (l === "offline" ? l : "polling")); }
        });
      cleanups.push(() => { void sb.removeChannel(channel); });
    })();

    return () => { alive = false; clearTimeout(timer); clearInterval(poll); cleanups.forEach((c) => c()); };
  }, [limit]);

  return { rows, link, updatedAt };
}

const tickers = new Map<number, { subs: Set<() => void>; id?: ReturnType<typeof setInterval> }>();
/** The current time, rounded down to `step` ms and updated every `step`. 0 during server render. */
export function useNow(step = 30_000) {
  return useSyncExternalStore(
    (cb) => {
      let t = tickers.get(step);
      if (!t) { t = { subs: new Set() }; tickers.set(step, t); }
      t.subs.add(cb);
      if (!t.id) { const tt = t; tt.id = setInterval(() => tt.subs.forEach((f) => f()), Math.min(step, 1000)); }
      return () => { t!.subs.delete(cb); if (!t!.subs.size) { clearInterval(t!.id); t!.id = undefined; } };
    },
    () => Math.floor(Date.now() / step) * step,
    () => 0,
  );
}
