"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarIcon, GitMergeIcon, MarkGithubIcon, SignOutIcon, VerifiedIcon } from "@primer/octicons-react";
import { boardMembers } from "@/lib/board";
import { EVENTS, eventDate, eventSlug } from "@/lib/events";
import { hasSupabase } from "@/lib/epoch/store";

/* "My club" (/me): sign in with GitHub and see your own club life in one place: the events you came to (with their
   certificates), your merges and badges on the board, and your Epoch wallet. Everything is read as you, through
   row-level security and my_attendance(), so nobody else's data is ever on this page. */
type Attended = { id: string; event: string; name: string };
type State =
  | { s: "loading" } | { s: "off" } | { s: "out" }
  | { s: "in"; name: string; handle: string; email: string; attended: Attended[]; coins: number | null };

export function MyClub() {
  const [st, setSt] = useState<State>(hasSupabase ? { s: "loading" } : { s: "off" });
  useEffect(() => {
    if (!hasSupabase) return;
    let live = true;
    void (async () => {
      const { supabase, finishLogin } = await import("@/lib/epoch/supabase-store");
      await finishLogin();
      const sb = supabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!live) return;
      if (!user) { setSt({ s: "out" }); return; }
      const [att, prof] = await Promise.all([sb.rpc("my_attendance"), sb.from("profiles").select("coins").eq("id", user.id).maybeSingle()]);
      if (!live) return;
      const meta = user.user_metadata as { user_name?: string; full_name?: string; name?: string };
      setSt({ s: "in", handle: meta.user_name ?? "", name: meta.full_name || meta.name || meta.user_name || "You", email: user.email ?? "",
        attended: (att.data as Attended[] | null) ?? [], coins: (prof.data as { coins: number } | null)?.coins ?? null });
    })();
    return () => { live = false; };
  }, []);

  if (st.s === "loading") return <div className="h-64" aria-busy="true" />;
  if (st.s === "off") return <Note>Sign-in isn&apos;t switched on for this site yet.</Note>;
  if (st.s === "out") return (
    <div className="mt-12 max-w-[560px] rounded-[18px] border border-line bg-white p-6 sm:p-8">
      <p className="text-[18px] text-ink-2">Sign in to see the events you came to, your certificates, and what you&apos;ve merged this year.</p>
      <button type="button" onClick={async () => (await import("@/lib/epoch/supabase-store")).startLogin("/me")} className="press mt-6 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 font-display font-bold text-white transition-colors duration-150 hover:bg-ink/85"><MarkGithubIcon size={18} />Sign in with GitHub</button>
      <p className="mt-4 text-[13.5px] text-ink-3">We only read your public GitHub name and email. <Link href="/privacy" className="underline">Privacy</Link></p>
    </div>
  );

  const onBoard = boardMembers().some((m) => m.handle.toLowerCase() === st.handle.toLowerCase());
  const signOut = async () => { await (await import("@/lib/epoch/supabase-store")).supabase().auth.signOut(); setSt({ s: "out" }); };
  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {st.handle && <img src={`https://github.com/${st.handle}.png?size=160`} alt="" width={64} height={64} className="h-16 w-16 rounded-full border border-line" />}
        <div className="min-w-0 flex-1"><p className="text-[24px] font-semibold leading-tight">{st.name}</p>{st.handle && <p className="font-mono text-[14px] text-ink-3">@{st.handle}</p>}</div>
        <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13.5px] text-ink-2 transition hover:border-ink hover:text-ink"><SignOutIcon size={14} />Sign out</button>
      </div>

      <section className="mt-10" aria-labelledby="came">
        <h2 id="came" className="flex items-center gap-2 text-[24px]"><CalendarIcon size={20} />Events you came to</h2>
        {st.attended.length ? (
          <ul className="mt-4 divide-y divide-line rounded-[14px] border border-line bg-white">
            {st.attended.map((a) => { const e = EVENTS.find((x) => x.date === a.event); return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className="min-w-0 flex-1"><span className="block font-semibold">{e ? <Link href={`/events/${eventSlug(e)}`} className="hover:text-link">{e.title}</Link> : a.event}</span>{e && <span className="text-[13.5px] text-ink-3">{eventDate(e)}</span>}</span>
                <Link href={`/certificates/${a.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#dafbe1] px-3 py-1.5 text-[13.5px] font-semibold text-[#1a7f37]"><VerifiedIcon size={14} />Certificate</Link>
              </li>
            ); })}
          </ul>
        ) : <Note>No events recorded for {st.email || "you"} yet. After a session, organisers add everyone Luma checked in, and your certificate appears here.</Note>}
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[14px] border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 text-[19px]"><GitMergeIcon size={18} className="text-[#8250df]" />Merges and badges</h2>
          {onBoard ? <p className="mt-2 text-[15px] text-ink-2">Your pull requests merged into other people&apos;s projects, and the badges they earned. <Link href={`/board/${st.handle.toLowerCase()}`} className="font-semibold text-link hover:underline">Open your board page →</Link></p>
            : <p className="mt-2 text-[15px] text-ink-2">You&apos;re not on the board yet: it follows the GitHub usernames on the team and contributors lists. Ask a lead to add <b className="font-mono">@{st.handle}</b>.</p>}
        </div>
        <div className="rounded-[14px] border border-line bg-white p-5">
          <h2 className="text-[19px]">Epoch wallet</h2>
          {st.coins !== null ? <p className="mt-2 text-[15px] text-ink-2"><b className="font-display text-[22px] text-ink">{st.coins}</b> coins. <Link href="/epoch/wallet" className="font-semibold text-link hover:underline">Open your wallet →</Link></p>
            : <p className="mt-2 text-[15px] text-ink-2">No Epoch ticket yet. <Link href="/epoch/register" className="font-semibold text-link hover:underline">Get one</Link> when registrations open.</p>}
        </div>
      </section>
    </div>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => <p className="mt-4 rounded-[14px] border-2 border-dashed border-line p-5 text-[16px] text-ink-2">{children}</p>;
