"use client";
import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@primer/octicons-react";
import { supabase } from "@/lib/epoch/supabase-store";
import { todayIST, addDays } from "@/lib/admin/appointments";
import { Sticker } from "@/components/ui/Sticker";
import { Node } from "./kit";

/* The first thing an organiser sees: what is waiting for THEM, gathered from every part of the admin, each with a
   link straight to it. Without this the system is a row of tabs to check one by one; with it, it is a to-do list.
   Everything is read as the signed-in person, so the database decides what they can see (and so what they're asked).
   The same list puts a count next to each section in the menu. */
type Bucket = "late" | "week" | "decide" | "care";
export type Need = { key: string; count: number; text: string; section: string | null; href: string; bucket: Bucket; warn?: boolean };
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "late", label: "Late" }, { id: "week", label: "Due this week" }, { id: "decide", label: "Waiting for you" }, { id: "care", label: "Look after the club" },
];
const say = (n: number, one: string, many: string) => (n === 1 ? one : many);

async function gather(me: string, admin: boolean): Promise<Need[]> {
  const sb = supabase(), today = todayIST(), soon = addDays(today, 14), items: Need[] = [];
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => { const r = await q; return r.error ? 0 : r.count ?? 0; };
  const head = { count: "exact" as const, head: true };
  const add = (key: string, n: number, text: string, section: string | null, bucket: Bucket, warn = false) => items.push({ key, count: n, text, section, href: section ? `#${section}` : "/hub", bucket, warn });

  const [myOverdue, myWeek, mine] = await Promise.all([
    count(sb.from("tasks").select("id", head).eq("owner_id", me).in("status", ["todo", "doing", "blocked"]).lt("due_on", today)),
    count(sb.from("tasks").select("id", head).eq("owner_id", me).in("status", ["todo", "doing", "blocked"]).gte("due_on", today).lte("due_on", addDays(today, 7))),
    sb.from("project_ideas").select("id").eq("owner_id", me),
  ]);
  if (myOverdue) add("overdue", myOverdue, say(myOverdue, "task of yours is overdue", "tasks of yours are overdue"), "tasks", "late", true);
  if (myWeek) add("week", myWeek, say(myWeek, "task of yours is due this week", "tasks of yours are due this week"), "tasks", "week");
  const myProjects = (mine.data ?? []).map((p) => p.id as number);
  if (myProjects.length) {
    const asks = await count(sb.from("project_requests").select("id", head).in("project_id", myProjects).eq("status", "pending"));
    if (asks) add("asks", asks, say(asks, "person wants to join your project", "people want to join your project"), null, "decide");
  }

  // reviews you were asked to do: applications in your rounds without your score
  const rounds = (await sb.from("campaign_reviewers").select("campaign_id").eq("user_id", me)).data ?? [];
  if (rounds.length) {
    const apps = (await sb.from("applications").select("id").in("campaign_id", rounds.map((r) => r.campaign_id)).in("status", ["submitted", "screening", "interview"])).data ?? [];
    const done = new Set(((await sb.from("application_reviews").select("application_id").eq("reviewer_id", me)).data ?? []).map((r) => r.application_id));
    const left = apps.filter((a) => !done.has(a.id)).length;
    if (left) add("reviews", left, say(left, "application is waiting for your review", "applications are waiting for your review"), "recruitment", "decide");
  }

  // things only someone else can approve: you can't decide your own, so they are for the others
  const featuring = await count(sb.from("project_ideas").select("id", head).eq("publish_state", "requested").neq("owner_id", me));
  if (featuring) add("featuring", featuring, say(featuring, "project asks to be featured on the website", "projects ask to be featured on the website"), "projects", "decide");

  if (admin) {
    const [proposals, drafts, ending, problems] = await Promise.all([
      count(sb.from("event_proposals").select("id", head).eq("status", "submitted").neq("proposed_by", me)),
      count(sb.from("policy_drafts").select("policy_id", head).neq("author_id", me)),
      count(sb.from("appointments").select("id", head).is("revoked_at", null).gte("ends_on", today).lte("ends_on", soon)),
      sb.rpc("asset_warnings"),
    ]);
    if (proposals) add("proposals", proposals, say(proposals, "event proposal is waiting for a decision", "event proposals are waiting for a decision"), "proposals", "decide");
    if (drafts) add("drafts", drafts, say(drafts, "policy draft is waiting for a second admin", "policy drafts are waiting for a second admin"), "policies", "decide");
    if (ending) add("ending", ending, say(ending, "person's access ends within 14 days", "people's access ends within 14 days"), "people", "care", true);
    const assets = new Set(((problems.data ?? []) as { id: number }[]).map((p) => p.id)).size;
    if (assets) add("assets", assets, say(assets, "account needs an owner, a backup or a check", "accounts need an owner, a backup or a check"), "assets", "care", true);
    const admins = await count(sb.from("appointments").select("user_id", head).eq("role", "admin").is("revoked_at", null).lte("starts_on", today).gte("ends_on", today));
    if (admins < 2) add("admins", admins, admins === 1 ? "admin is active: appoint a second" : "admins are active: appoint one", "people", "care", true);
  }
  return items;
}

/** What needs this person, read again whenever `key` changes (the admin passes the open section, so counts stay fresh). */
export function useNeeds(meId: string, admin: boolean, key: string) {
  const [items, setItems] = useState<Need[] | null>(null);
  useEffect(() => { if (!meId) return; let live = true; void gather(meId, admin).then((x) => { if (live) setItems(x); }).catch(() => { if (live) setItems([]); }); return () => { live = false; }; }, [meId, admin, key]);
  return items;
}

/** How many things wait in each section, for the menu. "Too few admins" counts as one thing, not as the number of admins. */
export const perSection = (items: Need[] | null) => (items ?? []).reduce<Record<string, number>>((m, i) => (i.section ? { ...m, [i.section]: (m[i.section] ?? 0) + (i.key === "admins" ? 1 : i.count) } : m), {});

const hello = () => { const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date())); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const dayName = () => new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date());

export function NeedsYou({ items, name, groupOf, labelOf }: { items: Need[] | null; name: string; groupOf: (section: string | null) => string; labelOf: (section: string | null) => string }) {
  const total = (items ?? []).length;
  const first = name.trim().split(/\s+/)[0] || "there";
  return (
    <section aria-labelledby="needs-h" className="overflow-hidden rounded-[16px] border-2 border-ink bg-white">
      <div className="flex items-start justify-between gap-6 px-5 pb-6 pt-6 sm:px-8">
        <div className="min-w-0">
          <p className="font-mono text-[12.5px] text-ink-3" suppressHydrationWarning>{"// "}{dayName()}</p>
          <h2 id="needs-h" className="mt-2 font-display text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[36px]" suppressHydrationWarning>
            {hello()}, {first}.
            <span className="block text-ink-3">{items === null ? "Checking what's waiting…" : total === 0 ? "Nothing needs you right now." : `${total} ${total === 1 ? "thing needs" : "things need"} you.`}</span>
          </h2>
        </div>
        {items !== null && total === 0 && <Sticker name="skate" size={112} tilt={6} className="hidden flex-none sm:block" />}
      </div>
      {items === null ? <div className="h-24 border-t border-line" aria-busy="true" /> : total === 0 ? (
        <p className="border-t border-line px-5 py-4 text-[15px] text-ink-2 sm:px-8">When a task comes due, someone asks to join your project or a decision waits on you, it shows up here. Meanwhile, <a href="/hub" className="font-semibold text-link underline-offset-4 hover:underline">see what members are building</a>.</p>
      ) : BUCKETS.map((b) => {
        const list = items.filter((i) => i.bucket === b.id);
        if (!list.length) return null;
        return (
          <div key={b.id}>
            <h3 className="border-t border-line bg-soft px-5 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.08em] text-ink-3 sm:px-8">{b.label}</h3>
            <ul className="divide-y divide-line border-t border-line">
              {list.map((i) => (
                <li key={i.key}>
                  <a href={i.href} className="group flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-soft sm:gap-4 sm:px-8">
                    <Node group={groupOf(i.section)} size={22} />
                    <span className={`min-w-[2ch] text-right font-mono text-[22px] font-bold leading-none tabular-nums ${i.warn ? "text-[#a40e26]" : "text-ink"}`}>{i.count}</span>
                    <span className="min-w-0 flex-1 text-[15.5px] leading-snug">{i.text}</span>
                    <span className="hidden whitespace-nowrap text-[13px] text-ink-3 sm:inline">{labelOf(i.section)}</span>
                    <ArrowRightIcon size={16} aria-hidden className="flex-none text-ink-3 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
