"use client";
import { tabKeys } from "@/components/ui/tabKeys";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { hasSupabase } from "@/lib/epoch/store";
import { canTakePart, ideas as loadIdeas, whoAmI, type Idea, type JoinRequest, type TeamMember } from "@/lib/hub/client";
import { FindPeople } from "./FindPeople";
import { Ideas } from "./Ideas";
import { Interests } from "./Interests";
import { MyTeams } from "./MyTeams";

/* The project hub (/hub): sign in with GitHub, say what you like, find a project or people. Only active members and the
   core team get in; the database decides (can_take_part), this page only explains. */
type Who = { id: string; handle: string; name: string };
type State = { s: "loading" } | { s: "off" } | { s: "out" } | { s: "closed"; who: Who } | { s: "in"; who: Who };
type Data = { ideas: Idea[]; team: TeamMember[]; requests: JoinRequest[]; names: Record<string, { handle: string; name: string }> };
const TABS = [["into", "What I'm into"], ["ideas", "Project ideas"], ["people", "Find people"], ["teams", "My teams"]] as const;
type Tab = (typeof TABS)[number][0];

export function ProjectHub() {
  const [st, setSt] = useState<State>(hasSupabase ? { s: "loading" } : { s: "off" });
  const [tab, setTab] = useState<Tab>("into"); const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    if (!hasSupabase) return;
    let live = true;
    void (async () => {
      const { finishLogin } = await import("@/lib/epoch/supabase-store");
      await finishLogin();
      const who = await whoAmI();
      if (!live) return;
      if (!who) return setSt({ s: "out" });
      const ok = await canTakePart();
      if (live) setSt(ok ? { s: "in", who } : { s: "closed", who });
    })();
    return () => { live = false; };
  }, []);
  const reload = useCallback(async () => setData(await loadIdeas()), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { if (st.s === "in") void reload(); }, [st.s, reload]);
  const signOut = async () => { await (await import("@/lib/epoch/supabase-store")).supabase().auth.signOut(); setSt({ s: "out" }); };

  const box = "mt-10 max-w-[600px] rounded-[18px] border border-line bg-white p-6 sm:p-8";
  if (st.s === "loading") return <div className="h-64" aria-busy="true" />;
  if (st.s === "off") return <div className={box}><p className="text-[18px] text-ink-2">The project hub isn&apos;t switched on for this site yet.</p></div>;
  if (st.s === "out") return (
    <div className={box}>
      <p className="text-[18px] text-ink-2">Sign in with GitHub to tell us what you&apos;d like to build, find a project that needs you, or find people who have the skills you&apos;re missing.</p>
      <button type="button" onClick={async () => (await import("@/lib/epoch/supabase-store")).startLogin("/hub")} className="press mt-6 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 font-display font-bold text-white">Sign in with GitHub</button>
      <p className="mt-4 text-[13.5px] text-ink-3">We only read your public GitHub name and email. <Link href="/privacy" className="underline">Privacy</Link></p>
    </div>
  );
  if (st.s === "closed") return (
    <div className={box}>
      <h2 className="text-[26px]">This space is for club members</h2>
      <p className="mt-3 text-[17px] text-ink-2">You&apos;re signed in as <b>@{st.who.handle}</b>, but we don&apos;t have you down as an active member yet. If you&apos;re already in the club, ask a lead to add you to the members list. If you&apos;d like to join, see <Link href="/get-involved" className="underline underline-offset-2">Get involved</Link>.</p>
      <p className="mt-3 text-[15px] text-ink-3">You can still look at the <Link href="/projects" className="underline underline-offset-2">projects we&apos;ve built</Link>.</p>
    </div>
  );

  const pendingForMe = data ? data.requests.filter((r) => r.status === "pending" && data.ideas.some((i) => i.id === r.project_id && i.owner_id === st.who.id)).length : 0;
  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {st.who.handle && <img src={`https://github.com/${st.who.handle}.png?size=120`} alt="" width={48} height={48} className="h-12 w-12 rounded-full border border-line" />}
        <p className="min-w-0 flex-1 text-[18px]"><b>{st.who.name}</b> <span className="font-mono text-[14px] text-ink-3">@{st.who.handle}</span></p>
        <button type="button" onClick={signOut} className="rounded-full border border-line px-3 py-1.5 text-[13.5px] text-ink-2 transition hover:border-ink hover:text-ink">Sign out</button>
      </div>
      <div role="tablist" onKeyDown={tabKeys} aria-label="Project hub" className="mt-8 flex flex-wrap gap-1 border-b border-line pb-3">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} tabIndex={(tab === id) ? 0 : -1} aria-controls="hub-panel" onClick={() => setTab(id)} className={`rounded-md px-4 py-2.5 text-[16px] ${tab === id ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>
            {label}{id === "teams" && pendingForMe > 0 && <span className="ml-2 rounded-full bg-[#fd8c73] px-2 py-0.5 text-[12px] font-bold text-ink">{pendingForMe}</span>}
          </button>
        ))}
      </div>
      <div id="hub-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-8">
        {tab === "into" && <Interests uid={st.who.id} />}
        {tab === "ideas" && (data ? <Ideas uid={st.who.id} data={data} names={data.names} reload={reload} /> : <div className="h-48" aria-busy="true" />)}
        {tab === "people" && <FindPeople />}
        {tab === "teams" && (data ? <MyTeams uid={st.who.id} data={data} names={data.names} reload={reload} /> : <div className="h-48" aria-busy="true" />)}
      </div>
    </div>
  );
}
