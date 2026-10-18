"use client";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useEpoch } from "@/components/epoch/EpochProvider";
import { ensureProfile, signedInUser } from "@/lib/admin/client";
import { OFF_KEY, ORGANISER_KEY } from "@/lib/shortcuts";
import { Activity } from "./Activity";
import { Assets } from "./Assets";
import { Attendance } from "./Attendance";
import { ClubPulse, FeedbackSummary, Inbox, SignUps } from "./Club";
import { Node, Role, btn, card } from "./kit";
import { Meetings } from "./Meetings";
import { Members } from "./Members";
import { NeedsYou, perSection, useNeeds } from "./NeedsYou";
import { Proposals } from "./Proposals";
import { Recruitment } from "./Recruitment";
import { Tasks } from "./Tasks";
import { People } from "./People";
import { ProjectsAdmin } from "./ProjectsAdmin";
import { Policies } from "./Policies";
import { SiteErrors } from "./SiteErrors";
import { ClubMark } from "@/components/ui/ClubMark";
import { Sticker } from "@/components/ui/Sticker";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/* The club's admin dashboard. Who may see it is decided by the database (an active appointment), not by this page:
   signed out → "Sign in with GitHub"; signed in but not an organiser → ask an admin; organisers → the dashboard. */
// `core`: for the core team and admins (volunteers are event-day staff: attendance and the Epoch desk). `admin`: admins only.
const SECTIONS = [
  { id: "overview", label: "Needs you", group: "Club", core: true },
  { id: "attendance", label: "Attendance & certificates", group: "Club" },
  { id: "signups", label: "Sign-ups & email", group: "Club", core: true },
  { id: "messages", label: "Messages", group: "Club", core: true },
  { id: "feedback", label: "Feedback", group: "Club", core: true },
  { id: "members", label: "Members", group: "People", core: true },
  { id: "recruitment", label: "Recruitment", group: "People", core: true },
  { id: "projects", label: "Projects", group: "People", core: true },
  { id: "people", label: "People & roles", group: "People" },
  { id: "proposals", label: "Event proposals", group: "Work", core: true },
  { id: "tasks", label: "Tasks", group: "Work", core: true },
  { id: "meetings", label: "Meetings & decisions", group: "Work", core: true },
  { id: "assets", label: "Assets & handover", group: "Work", core: true },
  { id: "policies", label: "Policies", group: "Work", core: true },
  { id: "activity", label: "Activity", group: "Site", admin: true },
  { id: "errors", label: "Site errors", group: "Site", admin: true },
] as const satisfies readonly { id: string; label: string; group: string; admin?: boolean; core?: boolean }[];
type Section = (typeof SECTIONS)[number]["id"];

const door = `${card} mx-auto max-w-[560px] p-6 sm:p-8`; // the cards before the dashboard: sign in, no access yet
const doorH = "font-display text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]";

/* The frame: the club's mark, then the path you're on (club / admin), like a repository's; your role, the light/dark
   switch and sign out on the right. */
function Shell({ children, who, role, onSignOut }: { children: React.ReactNode; who?: string; role?: string; onSignOut?: () => void }) {
  return (
    <div className="min-h-screen bg-soft">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1240px] items-center gap-2.5 px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5 font-display text-[16px] font-semibold">
            <ClubMark size={30} />
            <span className="hidden sm:inline">GitHub Community</span> <b className="rounded bg-brand px-1.5 font-black">BLR</b>
          </Link>
          <span aria-hidden className="text-[20px] font-light text-ink-3">/</span>
          <a href="#overview" className="font-mono text-[14.5px] font-semibold">admin</a>
          <div className="ml-auto flex items-center gap-1.5 text-[14px] sm:gap-3">
            {role && <span className="hidden sm:inline-flex"><Role role={role}>{role}</Role></span>}
            {who && <a href={`https://github.com/${who}`} target="_blank" rel="noopener" className="hidden items-center gap-2 font-semibold sm:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://github.com/${who}.png?size=48`} alt="" width={24} height={24} className="rounded-full" />@{who}
            </a>}
            <ThemeToggle />
            {onSignOut && <button onClick={onSignOut} className="whitespace-nowrap rounded-md px-2 py-1.5 text-ink-2 transition-colors duration-150 hover:bg-soft hover:text-ink">Sign out</button>}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1240px] px-5 py-8">{children}</main>
    </div>
  );
}

/** Under the menu: the one-key jumps, and a switch to turn them off on this device. */
function KeysNote() {
  const [off, setOff] = useState<boolean | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reads this device's choice once, after the first paint
  useEffect(() => { try { setOff(localStorage.getItem(OFF_KEY) === "1"); } catch { setOff(null); } }, []);
  if (off === null) return null;
  const flip = () => { try { if (off) localStorage.removeItem(OFF_KEY); else localStorage.setItem(OFF_KEY, "1"); setOff(!off); } catch { /* storage blocked */ } };
  const k = "rounded border border-line bg-white px-1.5 py-px font-mono text-[11.5px] font-semibold text-ink";
  return (
    <p className="mt-3 hidden text-[13px] leading-relaxed text-ink-3 md:block md:pl-8">
      {off ? "One-key shortcuts are off." : <>From any page: <kbd className={k}>A</kbd> admin, <kbd className={k}>E</kbd> Epoch desk.</>}{" "}
      <button onClick={flip} className="font-semibold text-ink-2 underline underline-offset-2 hover:text-ink">{off ? "Turn on" : "Turn off"}</button>
    </p>
  );
}

export function AdminApp() {
  const { store, me, ready, refresh } = useEpoch();
  const [user, setUser] = useState<Awaited<ReturnType<typeof signedInUser>> | undefined>(undefined);
  const [section, setSection] = useState<Section>("overview");
  const [err, setErr] = useState("");
  const live = store?.mode === "supabase";
  // what waits for this person, for the home and the menu's counts (core and admins; read again on each section change)
  const staff = me?.role === "admin" || me?.role === "core";
  const needs = useNeeds(staff ? me!.id : "", me?.role === "admin", section);

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

  // an organiser on this device: the one-key jumps (A, E) work from any page of the site (lib/shortcuts.ts)
  const organiser = !!user && !!me && me.role !== "attendee";
  useEffect(() => { if (organiser) try { localStorage.setItem(ORGANISER_KEY, "1"); } catch { /* storage blocked */ } }, [organiser]);
  const signOut = async () => { try { localStorage.removeItem(ORGANISER_KEY); } catch { /* storage blocked */ } await store?.signOut(); await refresh(); setUser(null); };
  const login = () => { window.location.href = new URL("/api/auth/github?next=/admin", window.location.origin).href; };

  if (!ready || (live && user === undefined)) return <Shell><div className="h-64" aria-busy="true" /></Shell>;
  if (!live) return (
    <Shell><section className={door}>
      <h1 className={doorH}>Admin</h1>
      <p className="mt-3 text-ink-2">The database isn&apos;t connected on this copy of the site, so there&apos;s nothing to manage yet. Connect it with <code>npm run connect</code> (see the README), then sign in here with GitHub.</p>
    </section></Shell>
  );
  if (!user) return (
    <Shell><section className={`${door} max-w-[480px] text-center`}>
      <Sticker name="bouncer" size={104} tilt={-4} className="mx-auto -mt-2 mb-3" />
      <h1 className={doorH}>Club admin</h1>
      <p className="mt-3 text-ink-2">For the core team. Sign in with the GitHub account an admin gave access to.</p>
      {err && <p role="alert" className="mt-4 rounded-md bg-[#ffebe9] px-4 py-3 text-[14.5px] text-[#a40e26]">{err}</p>}
      <button onClick={login} className={`${btn} mt-6 w-full !py-3 !text-[15.5px]`}>
        <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
        Sign in with GitHub
      </button>
    </section></Shell>
  );
  if (!me || me.role === "attendee") return (
    <Shell who={user.handle} onSignOut={signOut}><section className={`${door} max-w-[620px]`}>
      <h1 className={doorH}>You&apos;re signed in, but you don&apos;t have organiser access</h1>
      <p className="mt-3 text-ink-2">Either you haven&apos;t been given access yet, or it has ended. Ask a club admin to open <b>Admin → People &amp; roles</b> and give access to <code>@{user.handle || me?.handle}</code>. Then reload this page.</p>
      <p className="mt-3 text-[14px] text-ink-3">First admin? It has to be set once in the database: in Supabase, open SQL Editor and run <code>select bootstrap_admin(&apos;{user.handle || "your-github-username"}&apos;, &apos;YYYY-MM-DD&apos;);</code> with the day that access should end.</p>
    </section></Shell>
  );

  const admin = me.role === "admin", core = admin || me.role === "core";
  const allowed = SECTIONS.filter((s) => (admin || !("admin" in s)) && (core || !("core" in s)));
  const current = (allowed.some((s) => s.id === section) ? section : allowed[0].id) as Section;
  const here = SECTIONS.find((s) => s.id === current)!;
  const counts = perSection(needs);
  const sectionOf = (id: string | null) => SECTIONS.find((s) => s.id === id);
  return (
    <Shell who={me.handle} role={me.role} onSignOut={signOut}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[232px_minmax(0,1fr)] md:gap-10">
        {/* the sections hang off one branch, like the site's menu: a node for each group, HEAD (green) where you are */}
        <nav aria-label="Admin sections" className="-mx-5 min-w-0 overflow-x-auto px-5 md:sticky md:top-6 md:mx-0 md:self-start md:overflow-visible md:px-0">
          <ul className="adm-branch">
            {allowed.map((s, i) => (
              <Fragment key={s.id}>
                {(i === 0 || allowed[i - 1].group !== s.group) && <li aria-hidden className="adm-group"><Node group={s.group} size={20} />{s.group}</li>}
                <li className={`commit ${current === s.id ? "is-head" : ""}`}>
                  <a href={`#${s.id}`} aria-current={current === s.id ? "page" : undefined} className="adm-link">
                    <span className="commit-node" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {counts[s.id] ? <span className="adm-count">{counts[s.id]}<span className="sr-only"> waiting for you</span></span> : null}
                  </a>
                </li>
              </Fragment>
            ))}
          </ul>
          <Link href="/epoch/admin" className="adm-out">Epoch desk <span aria-hidden>↗</span></Link>
          <KeysNote />
        </nav>
        <div className="min-w-0 space-y-4">
          {current === "overview" ? <h1 className="sr-only">Needs you</h1> : (
            <div className="pb-1">
              <p className="flex items-center gap-2 font-mono text-[12.5px] text-ink-3"><Node group={here.group} size={16} />{here.group.toLowerCase()} / {here.label.toLowerCase()}</p>
              <h1 className="mt-1.5 font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[38px]">{here.label}</h1>
            </div>
          )}
          {!admin && <p className="text-[14px] text-ink-3">You&apos;re {me.role === "core" ? "on the core team" : "a volunteer"}: you can mark attendance and check people in; sending emails and changing who has access is for admins.</p>}
          {current === "overview" && <><NeedsYou items={needs} name={me.name || me.handle} groupOf={(id) => sectionOf(id)?.group ?? "People"} labelOf={(id) => sectionOf(id)?.label ?? "Project hub"} /><ClubPulse /></>}
          {current === "attendance" && <Attendance admin={admin} />}
          {current === "signups" && <SignUps />}
          {current === "messages" && <Inbox />}
          {current === "feedback" && <FeedbackSummary />}
          {current === "members" && <Members admin={admin} />}
          {current === "recruitment" && <Recruitment admin={admin} meId={me.id} />}
          {current === "proposals" && <Proposals admin={admin} meId={me.id} />}
          {current === "tasks" && <Tasks admin={admin} meId={me.id} />}
          {current === "meetings" && <Meetings admin={admin} meId={me.id} />}
          {current === "assets" && <Assets admin={admin} meId={me.id} />}
          {current === "policies" && <Policies admin={admin} meId={me.id} />}
          {current === "activity" && <Activity />}
          {current === "projects" && <ProjectsAdmin admin={admin} meId={me.id} />}
          {current === "people" && <People admin={admin} me={me.handle} />}
          {current === "errors" && (admin ? <SiteErrors /> : <p className="text-ink-2">Error reports are for admins.</p>)}
        </div>
      </div>
    </Shell>
  );
}
