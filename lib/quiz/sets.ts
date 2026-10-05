"use client";
import { hasRealtime } from "./room";

/* Quizzes saved for later: written now, hosted another day. Nobody can see or join one until it's hosted.
   Kept in this browser straight away, and in the database (quiz_sets, organisers only — see supabase/schema.sql)
   so another organiser's laptop has them too. */

export type QuizSet = { id: string; title: string; text: string; at: string };
const KEY = "quiz:sets";

const local = (): QuizSet[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") as QuizSet[]; } catch { return []; } };
const keep = (sets: QuizSet[]) => { try { localStorage.setItem(KEY, JSON.stringify(sets)); } catch { /* the database copy still counts */ } };
const db = async () => (await import("../epoch/supabase-store")).supabase();

export async function loadSets(): Promise<QuizSet[]> {
  let shared: QuizSet[] = [];
  if (hasRealtime) {
    try {
      const { data, error } = await (await db()).from("quiz_sets").select("id, title, body, updated_at").order("updated_at", { ascending: false }).limit(100);
      if (!error) shared = (data ?? []).map((r) => ({ id: r.id, title: r.title, text: r.body, at: r.updated_at }));
    } catch { /* the table may not exist yet */ }
  }
  const all = new Map<string, QuizSet>();
  [...shared, ...local()].forEach((s) => { const had = all.get(s.id); if (!had || had.at < s.at) all.set(s.id, s); }); // the newer edit wins
  return [...all.values()].sort((a, b) => b.at.localeCompare(a.at));
}

export async function saveSet(set: Omit<QuizSet, "id" | "at"> & { id?: string }): Promise<QuizSet> {
  const s: QuizSet = { id: set.id ?? crypto.randomUUID(), title: set.title.slice(0, 200), text: set.text.slice(0, 100_000), at: new Date().toISOString() };
  keep([s, ...local().filter((x) => x.id !== s.id)]);
  if (hasRealtime) { try { await (await db()).from("quiz_sets").upsert({ id: s.id, title: s.title, body: s.text, updated_at: s.at }); } catch { /* kept in this browser */ } }
  return s;
}

export async function deleteSet(id: string) {
  keep(local().filter((x) => x.id !== id));
  if (hasRealtime) { try { await (await db()).from("quiz_sets").delete().eq("id", id); } catch { /* fine */ } }
}
