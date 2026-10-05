"use client";
import type { Run } from "./game";
import { hasRealtime } from "./room";

/* Quizzes that were hosted, newest first. Each finished quiz is kept in this browser straight away, and in
   the database (quiz_runs, organisers only — see supabase/schema.sql) so any organiser can look back on it. */

const KEY = "quiz:history", KEEP = 40;

const local = (): Run[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") as Run[]; } catch { return []; } };

export async function saveRun(run: Run) {
  try { localStorage.setItem(KEY, JSON.stringify([run, ...local().filter((r) => r.id !== run.id)].slice(0, KEEP))); } catch { /* still saved below */ }
  if (!hasRealtime) return;
  try {
    const { supabase } = await import("../epoch/supabase-store");
    await supabase().from("quiz_runs").upsert({ id: run.id, title: run.title.slice(0, 200), code: run.code, players: run.players.length, result: run, created_at: run.at });
  } catch { /* kept in this browser */ }
}

export async function loadRuns(): Promise<Run[]> {
  const mine = local();
  let shared: Run[] = [];
  if (hasRealtime) {
    try {
      const { supabase } = await import("../epoch/supabase-store");
      const { data } = await supabase().from("quiz_runs").select("result").order("created_at", { ascending: false }).limit(KEEP);
      shared = (data ?? []).map((r) => r.result as Run);
    } catch { /* the table may not exist yet */ }
  }
  const seen = new Map<string, Run>();
  [...shared, ...mine].forEach((r) => { if (r?.id && !seen.has(r.id)) seen.set(r.id, r); });
  return [...seen.values()].sort((a, b) => b.at.localeCompare(a.at));
}

export function forget(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(local().filter((r) => r.id !== id))); } catch { /* fine */ }
}

/** The final table as a spreadsheet. */
export function toCsv(run: Run) {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  return ["Place,Name,Points,Right answers", ...run.players.map((p, i) => [i + 1, q(p.name), p.score, `${p.right}/${run.questions.length}`].join(","))].join("\n");
}
