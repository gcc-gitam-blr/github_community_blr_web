"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getStore } from "@/lib/epoch/store";
import type { EpochStore, Profile } from "@/lib/epoch/types";

interface Ctx { store: EpochStore | null; me: Profile | null; ready: boolean; offline: boolean; refresh: () => Promise<void> }
const EpochCtx = createContext<Ctx>({ store: null, me: null, ready: false, offline: false, refresh: async () => {} });
export const useEpoch = () => useContext(EpochCtx);

/* The last pass we loaded, kept so the wallet and its QR still open when the venue's signal drops. */
const LAST = "epoch:lastPass";
const remember = (p: Profile | null) => { try { if (p) localStorage.setItem(LAST, JSON.stringify(p)); else localStorage.removeItem(LAST); } catch { /* storage blocked */ } };
const recall = (): Profile | null => { try { const v = localStorage.getItem(LAST); return v ? JSON.parse(v) : null; } catch { return null; } };

export function EpochProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<EpochStore | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    const s = await getStore(); setStore(s);
    try {
      const p = await s.me();
      if (!p && !navigator.onLine) throw new Error("offline");
      setMe(p); setOffline(false); remember(p);
    } catch {
      setMe(recall()); setOffline(true); // no network: show the last known pass, read-only
    }
    setReady(true);
  }, []);

  // initial load from the async store; state is set after an await, not synchronously
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);
  // when the signal comes back, reload the real balance
  useEffect(() => { const back = () => void refresh(); window.addEventListener("online", back); return () => window.removeEventListener("online", back); }, [refresh]);

  return <EpochCtx.Provider value={{ store, me, ready, offline, refresh }}>{children}</EpochCtx.Provider>;
}
