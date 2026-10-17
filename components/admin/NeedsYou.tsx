"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/epoch/supabase-store";
import { todayIST, addDays } from "@/lib/admin/appointments";

/* The first thing an organiser sees: what is waiting for THEM, gathered from every part of the admin, each with a
   link straight to it. Without this the system is a row of tabs to check one by one; with it, it is a to-do list.
   Everything is read as the signed-in person, so the database decides what they can see (and so what they're asked). */
type Item = { key: string; count: number; text: string; href: string; tone?: "warn" };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function gather(me: string, admin: boolean): Promise<Item[]> {
  const sb = supabase(), today = todayIST(), soon = addDays(today, 14), items: Item[] = [];
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => { const r = await q; return r.error ? 0 : r.count ?? 0; };
  const head = { count: "exact" as const, head: true };

  const [myOverdue, myWeek, mine] = await Promise.all([
    count(sb.from("tasks").select("id", head).eq("owner_id", me).in("status", ["todo", "doing", "blocked"]).lt("due_on", today)),
    count(sb.from("tasks").select("id", head).eq("owner_id", me).in("status", ["todo", "doing", "blocked"]).gte("due_on", today).lte("due_on", addDays(today, 7))),
    sb.from("project_ideas").select("id").eq("owner_id", me),
  ]);
  if (myOverdue) items.push({ key: "overdue", count: myOverdue, text: `${plural(myOverdue, "of your tasks is", "of your tasks are")} overdue`, href: "#tasks", tone: "warn" });
  if (myWeek) items.push({ key: "week", count: myWeek, text: `${plural(myWeek, "task")} of yours due this week`, href: "#tasks" });
  const myProjects = (mine.data ?? []).map((p) => p.id as number);
  if (myProjects.length) {
    const asks = await count(sb.from("project_requests").select("id", head).in("project_id", myProjects).eq("status", "pending"));
    if (asks) items.push({ key: "asks", count: asks, text: `${plural(asks, "person wants", "people want")} to join your project`, href: "/hub" });
  }

  // reviews you were asked to do: applications in your rounds without your score
  const rounds = (await sb.from("campaign_reviewers").select("campaign_id").eq("user_id", me)).data ?? [];
  if (rounds.length) {
    const apps = (await sb.from("applications").select("id").in("campaign_id", rounds.map((r) => r.campaign_id)).in("status", ["submitted", "screening", "interview"])).data ?? [];
    const done = new Set(((await sb.from("application_reviews").select("application_id").eq("reviewer_id", me)).data ?? []).map((r) => r.application_id));
    const left = apps.filter((a) => !done.has(a.id)).length;
    if (left) items.push({ key: "reviews", count: left, text: `${plural(left, "application")} waiting for your review`, href: "#recruitment" });
  }

  // things only someone else can approve: you can't decide your own, so they are for the others
  const featuring = await count(sb.from("project_ideas").select("id", head).eq("publish_state", "requested").neq("owner_id", me));
  if (featuring) items.push({ key: "featuring", count: featuring, text: `${plural(featuring, "project asks", "projects ask")} to be featured on the website`, href: "#projects" });

  if (admin) {
    const [proposals, drafts, ending, problems] = await Promise.all([
      count(sb.from("event_proposals").select("id", head).eq("status", "submitted").neq("proposed_by", me)),
      count(sb.from("policy_drafts").select("policy_id", head).neq("author_id", me)),
      count(sb.from("appointments").select("id", head).is("revoked_at", null).gte("ends_on", today).lte("ends_on", soon)),
      sb.rpc("asset_warnings"),
    ]);
    if (proposals) items.push({ key: "proposals", count: proposals, text: `${plural(proposals, "event proposal")} waiting for a decision`, href: "#proposals" });
    if (drafts) items.push({ key: "drafts", count: drafts, text: `${plural(drafts, "policy draft")} waiting for a second admin`, href: "#policies" });
    if (ending) items.push({ key: "ending", count: ending, text: `${plural(ending, "person's access ends", "people's access ends")} within 14 days`, href: "#people", tone: "warn" });
    const assets = new Set(((problems.data ?? []) as { id: number }[]).map((p) => p.id)).size;
    if (assets) items.push({ key: "assets", count: assets, text: `${plural(assets, "account needs", "accounts need")} an owner, a backup or a check`, href: "#assets", tone: "warn" });
    const admins = await count(sb.from("appointments").select("user_id", head).eq("role", "admin").is("revoked_at", null).lte("starts_on", today).gte("ends_on", today));
    if (admins < 2) items.push({ key: "admins", count: admins, text: admins === 1 ? "Only one admin is active: appoint a second" : "No admin is active", href: "#people", tone: "warn" });
  }
  return items;
}

export function NeedsYou({ meId, admin }: { meId: string; admin: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => { let live = true; void gather(meId, admin).then((x) => { if (live) setItems(x); }).catch(() => { if (live) setItems([]); }); return () => { live = false; }; }, [meId, admin]);
  return (
    <section aria-labelledby="needs-h" className="rounded-[12px] border-2 border-ink bg-white">
      <h2 id="needs-h" className="flex items-center gap-2 border-b border-line px-5 py-3 text-[18px]">Needs you {items && items.length > 0 && <span className="rounded-full bg-[#fd8c73] px-2 py-0.5 text-[12px] font-bold text-ink">{items.length}</span>}</h2>
      {items === null ? <div className="h-24" aria-busy="true" /> : items.length === 0 ? (
        <p className="flex items-center gap-3 px-5 py-4 text-[15px] text-ink-2"><span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-[#dafbe1] font-bold text-[#116329]">✓</span>Nothing is waiting for you. Nice.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.key}>
              <a href={i.href} className="flex items-center gap-4 px-5 py-3 text-[15px] transition hover:bg-soft">
                <span className={`grid h-8 min-w-8 place-items-center rounded-full px-2 font-mono text-[14px] font-bold ${i.tone === "warn" ? "bg-[#fff8c5] text-[#7d4e00]" : "bg-soft text-ink"}`}>{i.count}</span>
                <span className="flex-1">{i.text}</span>
                <span aria-hidden className="text-ink-3">→</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
