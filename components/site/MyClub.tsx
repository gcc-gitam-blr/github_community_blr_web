"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GitMergeIcon, MarkGithubIcon, SignOutIcon } from "@primer/octicons-react";
import { boardMembers } from "@/lib/board";
import { EVENTS, todayInIndia } from "@/lib/events";
import { hasSupabase } from "@/lib/epoch/store";
import { CertWall, NextUp, YearStrip } from "./MemberHome";

/* "My club" (/me): a member's own home. Sign in with GitHub and see your year in the club as a contribution strip,
   the certificates you've collected (each event has its own design), what's next, your projects and your merges.
   Everything is read as you, through row-level security and my_attendance(), so nobody else's data is ever on this page. */
type Attended = { id: string; event: string; name: string };
type State =
  | { s: "loading" } | { s: "off" } | { s: "out" }
  | { s: "in"; name: string; handle: string; email: string; attended: Attended[]; coins: number | null; hub: boolean; board: { member: boolean; on_board: boolean } };

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
      const [att, prof, hub, board] = await Promise.all([sb.rpc("my_attendance"), sb.from("profiles").select("coins").eq("id", user.id).maybeSingle(), sb.rpc("can_take_part"), sb.rpc("my_board_status")]);
      if (!live) return;
      const meta = user.user_metadata as { user_name?: string; full_name?: string; name?: string };
      setSt({ s: "in", handle: meta.user_name ?? "", name: meta.full_name || meta.name || meta.user_name || "You", email: user.email ?? "",
        attended: (att.data as Attended[] | null) ?? [], coins: (prof.data as { coins: number } | null)?.coins ?? null, hub: hub.data === true,
        board: (board.data as { member: boolean; on_board: boolean } | null) ?? { member: false, on_board: false } });
    })();
    return () => { live = false; };
  }, []);

  if (st.s === "loading") return <div className="h-64" aria-busy="true" />;
  if (st.s === "off") return <Note>Sign-in isn&apos;t switched on for this site yet.</Note>;
  if (st.s === "out") return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-[18px] border-2 border-ink bg-white p-6 sm:p-8">
        <h2 className="text-[28px] leading-tight">Your corner of the club.</h2>
        <p className="mt-3 text-[17px] text-ink-2">Sign in with the GitHub account you use for the club. It takes one click, and there is no password to remember.</p>
        <button type="button" onClick={async () => (await import("@/lib/epoch/supabase-store")).startLogin("/me")} className="lift mt-6 inline-flex items-center gap-2 rounded-md border-2 border-ink bg-ink px-5 py-3 font-display font-bold text-white"><MarkGithubIcon size={18} />Sign in with GitHub</button>
        <p className="mt-4 text-[13.5px] text-ink-3">We only read your public GitHub name and email. <Link href="/privacy" className="underline">Privacy</Link></p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {[
          ["Your certificates", "One for every event you come to, each with its own design. Collect the year."],
          ["Your year", "Every event as a square: the ones you came to light up."],
          ["Your team", "Find people with the skills you're missing and build something together."],
          ["Your merges", "Pull requests you got merged, the badges they earned, and your Epoch wallet."],
        ].map(([t, d]) => <li key={t} className="rounded-[14px] border border-line bg-white p-4"><p className="font-semibold">{t}</p><p className="mt-1 text-[15px] text-ink-2">{d}</p></li>)}
      </ul>
    </div>
  );

  const today = todayInIndia();
  const listed = boardMembers().some((m) => m.handle.toLowerCase() === st.handle.toLowerCase()), onBoard = listed || st.board.on_board;
  const setBoard = async (on: boolean) => {
    const { supabase } = await import("@/lib/epoch/supabase-store");
    const { data } = await supabase().rpc("set_board_opt_in", { p_on: on });
    if (data?.ok) setSt({ ...st, board: { ...st.board, on_board: on } });
  };
  const past = EVENTS.filter((e) => e.date < today).length, came = st.attended.length;
  const signOut = async () => { await (await import("@/lib/epoch/supabase-store")).supabase().auth.signOut(); setSt({ s: "out" }); };
  return (
    <div className="mt-10 space-y-10">
      {/* the member card */}
      <section aria-label="You" className="rounded-[18px] border-2 border-ink bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {st.handle && <img src={`https://github.com/${st.handle}.png?size=160`} alt="" width={64} height={64} className="h-16 w-16 rounded-full border-2 border-ink" />}
          <div className="min-w-0 flex-1"><p className="text-[24px] font-semibold leading-tight">{st.name}</p>{st.handle && <p className="font-mono text-[14px] text-ink-3">@{st.handle}</p>}</div>
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13.5px] text-ink-2 transition hover:border-ink hover:text-ink"><SignOutIcon size={14} />Sign out</button>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Events", `${came}${past ? ` of ${past}` : ""}`],
            ["Certificates", String(came)],
            ["On the board", onBoard ? "Yes" : "Not yet"],
            ["Epoch coins", st.coins === null ? "No ticket" : String(st.coins)],
          ].map(([k, v]) => <div key={k} className="rounded-xl bg-soft px-4 py-3"><dt className="font-mono text-[12px] text-ink-3">{k}</dt><dd className="mt-0.5 font-display text-[24px] font-black leading-none">{v}</dd></div>)}
        </dl>
      </section>

      <NextUp today={today} />

      <section aria-labelledby="year-h">
        <h2 id="year-h" className="text-[26px]">Your year in the club</h2>
        <p className="mt-1 text-[15.5px] text-ink-2">{came ? `You've come to ${came} of the ${past} events so far.` : "Your squares light up as you come to events."} Green is a day you were there.</p>
        <YearStrip attended={st.attended} today={today} />
      </section>

      <section aria-labelledby="certs-h">
        <h2 id="certs-h" className="text-[26px]">Your certificates</h2>
        <p className="mt-1 text-[15.5px] text-ink-2">Each event has its own. {came ? "Open one to print it or add it to LinkedIn." : `They appear here after an event, once the organisers have recorded who came${st.email ? ` (we match ${st.email} and @${st.handle})` : ""}.`}</p>
        <CertWall attended={st.attended} today={today} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/hub" className="lift block rounded-[14px] border-2 border-ink bg-brand p-5">
          <h2 className="text-[20px]">Build something together</h2>
          <p className="mt-1.5 text-[15px] text-ink-2">{st.hub ? "Share an idea, find teammates by skill, or join a project." : "Once you're on the members list, the project hub is yours: ideas, teams and people."}</p>
          <p className="mt-3 font-semibold">Open the project hub →</p>
        </Link>
        <div className="rounded-[14px] border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 text-[19px]"><GitMergeIcon size={18} className="text-[#8250df]" />Merges and badges</h2>
          {onBoard ? <p className="mt-2 text-[15px] text-ink-2">Your pull requests merged into other people&apos;s projects. <Link href={`/board/${st.handle.toLowerCase()}`} className="font-semibold text-link hover:underline">Your board page →</Link></p>
            : st.board.member ? <p className="mt-2 text-[15px] text-ink-2">Show the pull requests you get merged on the club&apos;s public board, with your name and GitHub username.</p>
            : <p className="mt-2 text-[15px] text-ink-2">The board follows the team, contributors and members who opt in. Once you&apos;re on the members list you can switch it on here; meanwhile, <Link href="/contribute" className="font-semibold text-link hover:underline">find a first issue</Link>.</p>}
          {st.board.member && !listed && (
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[15px] font-semibold">
              <input type="checkbox" className="h-4 w-4" checked={st.board.on_board} onChange={(e) => void setBoard(e.target.checked)} />Show me on the board
            </label>
          )}
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
