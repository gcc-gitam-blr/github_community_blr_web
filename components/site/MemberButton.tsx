"use client";
import { useEffect, useState } from "react";
import { hasSupabase } from "@/lib/epoch/store";

/* The way back in for members: "Sign in" in the header, or their GitHub avatar once they are signed in, both opening
   My club. The sign-in check reads the saved session after the page has settled, so it never slows the first paint. */
export function useMember() {
  const [who, setWho] = useState<{ handle: string } | null | undefined>(undefined); // undefined = not checked yet
  useEffect(() => {
    if (!hasSupabase) return;
    let live = true;
    const run = async () => {
      const { supabase } = await import("@/lib/epoch/supabase-store");
      const { data } = await supabase().auth.getSession();
      const handle = (data.session?.user.user_metadata as { user_name?: string } | undefined)?.user_name;
      if (live) setWho(data.session ? { handle: handle ?? "" } : null);
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(() => void run()); else setTimeout(() => void run(), 400);
    return () => { live = false; };
  }, []);
  return who;
}

export function MemberButton() {
  const who = useMember();
  if (!hasSupabase || who === undefined) return null;
  if (who === null) return (
    <a href="/me" className="hidden h-9 flex-none items-center whitespace-nowrap rounded-full px-3 font-display text-[14px] font-semibold text-ink-2 transition-colors hover:bg-black/[.05] hover:text-ink lg:inline-flex">Sign in</a>
  );
  return (
    <a href="/me" aria-label="My club" title="My club" className="hidden h-9 w-9 flex-none place-items-center rounded-full ring-2 ring-transparent transition hover:ring-brand lg:grid">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {who.handle ? <img src={`https://github.com/${who.handle}.png?size=64`} alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full border border-line" /> : <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-ink font-mono text-[12px] font-bold text-white">me</span>}
    </a>
  );
}

/** In the phone menu: the same entry, as a full-width row. */
export function MemberMenuLink({ onClick }: { onClick: () => void }) {
  const who = useMember();
  if (!hasSupabase || who === undefined) return null;
  return (
    <a href="/me" onClick={onClick} className="press mt-5 flex items-center justify-center gap-2 rounded-md border-2 border-ink py-3 font-display text-[16px] font-bold">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {who?.handle && <img src={`https://github.com/${who.handle}.png?size=48`} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />}
      {who ? "My club" : "Members: sign in"}
    </a>
  );
}
