"use client";
import { useEffect, useState } from "react";
import { MarkGithubIcon } from "@primer/octicons-react";
import { useEpoch } from "@/components/epoch/EpochProvider";
import { ensureProfile, signedInUser } from "@/lib/admin/client";
import { Sticker } from "@/components/ui/Sticker";

/* Only organisers host. Same rule as /admin: sign in with GitHub, and profiles.role must be volunteer or admin
   (an admin gives it at /admin → People & roles). Without a database (local demo) anyone can try it. */
export function HostGate({ children }: { children: React.ReactNode }) {
  const { store, me, ready, refresh } = useEpoch();
  const [user, setUser] = useState<Awaited<ReturnType<typeof signedInUser>> | undefined>(undefined);
  const [err, setErr] = useState("");
  const live = store?.mode === "supabase";

  useEffect(() => {
    if (!ready || !live) return;
    let on = true;
    void (async () => {
      const r = await store!.loginResult?.();
      const u = await signedInUser();
      if (!on) return;
      if (r?.error) setErr(r.error);
      setUser(u);
      if (u && !me) { await ensureProfile(u.name || u.handle); await refresh(); } // first visit: a profile an admin can promote
    })();
    return () => { on = false; };
  }, [ready, live, store, me, refresh]);

  if (ready && !live) return <>{children}</>;
  if (!ready || user === undefined) return <Card><div className="h-40" aria-busy="true" /></Card>;
  if (!user) return (
    <Card>
      <Sticker name="bouncer" size={120} tilt={-6} />
      <h1 className="mt-5 text-[34px]">Organisers only.</h1>
      <p className="mt-2 text-[16px] text-white/65">Hosting a quiz is for the club team. Players don&apos;t need this page. They join at <b className="text-white">/quiz</b>.</p>
      {err && <p role="alert" className="mt-4 rounded-xl bg-[#ff7b72]/15 px-4 py-3 text-[14px] text-[#ffb4a8]">{err}</p>}
      <button onClick={() => { window.location.href = new URL("/api/auth/github?next=/quiz/host", window.location.origin).href; }}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[17px] font-bold text-[#0b0b0f]"><MarkGithubIcon size={20} />Sign in with GitHub</button>
    </Card>
  );
  if (!me || me.role === "attendee") return (
    <Card>
      <Sticker name="bouncer" size={120} tilt={-6} />
      <h1 className="mt-5 text-[30px]">Almost there, @{user.handle}.</h1>
      <p className="mt-2 text-[16px] text-white/65">You&apos;re signed in but not on the team list yet. Ask a club admin to open <b className="text-white">/admin → People &amp; roles</b> and add <code className="font-mono text-white">@{user.handle}</code>, then reload this page.</p>
      <button onClick={async () => { await store?.signOut(); await refresh(); setUser(null); }} className="mt-6 text-[14px] text-white/50 underline">Use a different account</button>
    </Card>
  );
  return <>{children}</>;
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <main className="grid min-h-dvh place-items-center bg-[#0b0b0f] px-5 py-12 text-white">
    <section className="flex w-full max-w-[440px] flex-col items-center text-center">{children}</section>
  </main>
);
