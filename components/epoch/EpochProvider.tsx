"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getStore } from "@/lib/epoch/store";
import type { EpochStore, Profile } from "@/lib/epoch/types";

interface Ctx { store: EpochStore | null; me: Profile | null; ready: boolean; refresh: () => Promise<void> }
const EpochCtx = createContext<Ctx>({ store: null, me: null, ready: false, refresh: async () => {} });
export const useEpoch = () => useContext(EpochCtx);

export function EpochProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<EpochStore | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const s = await getStore();
    setStore(s); setMe(await s.me()); setReady(true);
  }, []);

  // initial load from the async store; state is set after an await, not synchronously
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  return <EpochCtx.Provider value={{ store, me, ready, refresh }}>{children}</EpochCtx.Provider>;
}
