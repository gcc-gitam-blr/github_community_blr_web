"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useEpoch } from "@/components/epoch/EpochProvider";
import { ClubStatsPanel, FeedbackSummary, Inbox, SignUps } from "@/components/epoch/Lists";
import { ensureProfile, signedInUser } from "@/lib/admin/client";
import { Attendance } from "./Attendance";
import { People } from "./People";
import { SiteErrors } from "./SiteErrors";
import { ClubMark } from "@/components/ui/ClubMark";

/* The club's admin dashboard. Who may see it is decided by the database (profiles.role), not by this page:
   signed out → "Sign in with GitHub"; signed in but not an organiser → ask an admin; organisers → the dashboard. */
const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance & certificates" },
  { id: "signups", label: "Sign-ups & email" },
  { id: "messages", label: "Messages" },
  { id: "feedback", label: "Feedback" },
  { id: "people", label: "People & roles" },
  { id: "errors", label: "Site errors", admin: true },
] as const satisfies readonly { id: string; label: string; admin?: boolean }[];
type Section = (typeof SECTIONS)[number]["id"];

const card = "rounded-[12px] border border-line bg-white p-6 sm:p-8";
const btn = "inline-flex items-center justify-center rounded-md bg-ink px-5 py-3 font-display font-bold text-white transition hover:bg-ink/85 disabled:opacity-60";

function Shell({ children, who, onSignOut }: { children: React.ReactNode; who?: string; onSignOut?: () => void }) {
  return (
    <div className="min-h-screen bg-soft">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5 font-display text-[16px] font-semibold">
            <ClubMark size={32} />
            <span className="hidden sm:inline">GitHub Community</span> <b className="rounded bg-brand px-1.5 font-black">BLR</b>
          </Link>
          <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[12px] text-ink-2">admin</span>
          <div className="ml-auto flex items-center gap-4 text-[14px]">
            {who && <a href={`https://github.com/${who}`} target="_blank" rel="noopener" className="hidden items-center gap-2 sm:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://github.com/${who}.png?size=48`} alt="" width={24} height={24} className="rounded-full" />@{who}
            </a>}
            {onSignOut && <button onClick={onSignOut} className="whitespace-nowrap text-ink-2 underline-offset-4 hover:underline">Sign out</button>}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1240px] px-5 py-8">{children}</main>
    </div>
  );
}

export function AdminApp() {
  const { store, me, ready, refresh } = useEpoch();
  const [user, setUser] = useState<Awaited<ReturnType<typeof signedInUser>> | undefined>(undefined);
  const [section, setSection] = useState<Section>("overview");
  const [err, setErr] = useState("");
  const live = store?.mode === "supabase";

  // which section, from the address (#attendance), so links and the back button work
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1) as Section; if (SECTIONS.some((s) => s.id === h)) setSection(h); };
    read(); window.addEventListener("hashchange", read); return () => window.removeEventListener("hashchange", read);
  }, []);

  const check = useCallback(async () => {
    if (!live) return;
    const r = await store!.loginResult?.(); if (r?.error) setErr(r.error);
    const u = await signedInUser(); setUser(u);
    if (u && !me) { await ensureProfile(u.name || u.handle); await refresh(); } // first visit: make the profile so an admin can promote it
  }, [live, store, me, refresh]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the session, then sets state after awaits
  useEffect(() => { if (ready) void check(); }, [ready, check]);

  const signOut = async () => { await store?.signOut(); await refresh(); setUser(null); };
  const login = () => { window.location.href = new URL("/api/auth/github?next=/admin", window.location.origin).href; };

  if (!ready || (live && user === undefined)) return <Shell><div className="h-64" aria-busy="true" /></Shell>;
  if (!live) return (
    <Shell><section className={`${card} mx-auto max-w-[620px]`}>
      <h1 className="text-[30px]">Admin</h1>
      <p className="mt-3 text-ink-2">The database isn&apos;t connected on this copy of the site, so there&apos;s nothing to manage yet. Connect it with <code>npm run connect</code> (see the README), then sign in here with GitHub.</p>
    </section></Shell>
  );
  if (!user) return (
    <Shell><section className={`${card} mx-auto max-w-[520px] text-center`}>
      <h1 className="text-[30px]">Club admin</h1>
      <p className="mt-3 text-ink-2">For the core team. Sign in with the GitHub account an admin gave access to.</p>
      {err && <p role="alert" className="mt-4 rounded-md bg-[#ffebe9] px-4 py-3 text-[14.5px] text-[#a40e26]">{err}</p>}
      <button onClick={login} className={`${btn} mt-6 w-full gap-2`}>
        <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
        Sign in with GitHub
      </button>
    </section></Shell>
  );
  if (!me || me.role === "attendee") return (
    <Shell who={user.handle} onSignOut={signOut}><section className={`${card} mx-auto max-w-[620px]`}>
      <h1 className="text-[30px]">You&apos;re signed in, but not an organiser yet</h1>
      <p className="mt-3 text-ink-2">Ask a club admin to open <b>Admin → People &amp; roles</b> and add <code>@{user.handle || me?.handle}</code>. Then reload this page.</p>
      <p className="mt-3 text-[14px] text-ink-3">First admin? It has to be set once in the database: in Supabase, open SQL Editor and run <code>update profiles set role = &apos;admin&apos; where handle = &apos;{user.handle || "your-github-username"}&apos;;</code></p>
    </section></Shell>
  );

  const admin = me.role === "admin";
  return (
    <Shell who={me.handle} onSignOut={signOut}>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Admin sections" className="-mx-5 flex min-w-0 gap-1 overflow-x-auto px-5 md:mx-0 md:flex-col md:px-0">
          {SECTIONS.filter((s) => admin || !("admin" in s)).map((s) => (
            <a key={s.id} href={`#${s.id}`} aria-current={section === s.id ? "page" : undefined}
              className={`relative whitespace-nowrap rounded-md px-3 py-2 text-[14.5px] ${section === s.id ? "bg-white font-semibold shadow-[inset_0_0_0_1px_var(--color-line)] md:before:absolute md:before:-left-2 md:before:bottom-1.5 md:before:top-1.5 md:before:w-1 md:before:rounded md:before:bg-[#fd8c73]" : "text-ink-2 hover:bg-white/70"}`}>{s.label}</a>
          ))}
          <hr className="my-2 hidden border-line md:block" />
          <Link href="/epoch/admin" className="whitespace-nowrap rounded-md px-3 py-2 text-[14.5px] text-ink-2 hover:bg-white/70">Epoch desk ↗</Link>
        </nav>
        <div className="min-w-0 space-y-4">
          <h1 className="text-[28px]">{SECTIONS.find((s) => s.id === section)!.label}</h1>
          {!admin && <p className="text-[14px] text-ink-3">You&apos;re a volunteer: you can see everything and mark attendance; sending emails and changing roles is for admins.</p>}
          {section === "overview" && <ClubStatsPanel />}
          {section === "attendance" && <Attendance admin={admin} />}
          {section === "signups" && <SignUps />}
          {section === "messages" && <Inbox />}
          {section === "feedback" && <FeedbackSummary />}
          {section === "people" && <People admin={admin} me={me.handle} />}
          {section === "errors" && (admin ? <SiteErrors /> : <p className="text-ink-2">Error reports are for admins.</p>)}
        </div>
      </div>
    </Shell>
  );
}
