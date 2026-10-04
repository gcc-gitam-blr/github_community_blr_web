import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EPOCH } from "./config";
import type { AuditEntry, Booth, EpochStore, Profile, Reward, Tx } from "./types";
import { PENDING_NAME } from "./pending";

let client: SupabaseClient | null = null;
const sb = () => (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));

type Row = { id: string; handle: string; name: string; email: string | null; coins: number; earned: number; ticket: boolean; role: Profile["role"]; booth?: string | null; created_at: string };
const toProfile = (r: Row): Profile => ({ id: r.id, handle: r.handle, name: r.name, email: r.email ?? "", coins: r.coins, earned: r.earned, ticket: r.ticket, role: r.role, booth: r.booth ?? null, createdAt: r.created_at });
type TxRow = { id: number; user_id: string; delta: number; reason: string; ref: string; at: string; reverses?: number | null; reversed_at?: string | null };
const toTx = (t: TxRow): Tx => ({ id: String(t.id), userId: t.user_id, delta: t.delta, reason: t.reason, ref: t.ref, at: t.at, ...(t.reverses ? { reverses: String(t.reverses) } : {}), ...(t.reversed_at ? { reversedAt: t.reversed_at } : {}) });
const fail = (error: string) => ({ ok: false as const, error });
/** Calls one of the database's coin functions; they answer { ok, error?, … }. */
async function call<T extends object = object>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await sb().rpc(fn, args);
  if (error) return fail(error.message);
  return data?.ok ? { ok: true as const, ...(data as T) } : fail(data?.error ?? "That didn't work — please try again.");
}
/** The shared browser client, for the /admin dashboard. */
export const supabase = () => sb();

/* Back from "Sign in with GitHub" (/api/auth/github): the URL fragment carries a one-time token, or an error.
   Swap the token for a session once, and tidy the address bar. `back` is true when we just returned from GitHub. */
export type LoginResult = { back: boolean; error: string | null };
let finished: Promise<LoginResult> | null = null;
export const finishLogin = () => (finished ??= (async () => {
  if (typeof window === "undefined") return { back: false, error: null };
  const h = new URLSearchParams(window.location.hash.slice(1));
  const token = h.get("sb_token"), err = h.get("login_error");
  if (!token && !err) return { back: false, error: null };
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (err) return { back: true, error: err };
  const { error } = await sb().auth.verifyOtp({ token_hash: token!, type: "email" });
  return { back: true, error: error ? "That sign-in didn't finish — please try again." : null };
})());
/** Sends the browser to GitHub; it comes back to `next` signed in. */
export const startLogin = (next = window.location.pathname) => { window.location.href = new URL(`/api/auth/github?next=${encodeURIComponent(next)}`, window.location.origin).href; }; // a server route: full navigation

export const supabaseStore: EpochStore = {
  mode: "supabase",
  loginResult: () => finishLogin(),

  async me() {
    await finishLogin();
    const { data: { user } } = await sb().auth.getUser();
    if (!user) return null;
    const { data } = await sb().from("profiles").select("*").eq("id", user.id).maybeSingle();
    return data ? toProfile(data as Row) : null;
  },

  /* Attendees sign in with GitHub. First call redirects to GitHub; once they're
     back with a session, the same call creates their profile. */
  async register({ name }) {
    await finishLogin();
    const { data: { user } } = await sb().auth.getUser();
    if (!user) {
      try { sessionStorage.setItem(PENDING_NAME, name); } catch { /* finishing automatically is a convenience */ }
      startLogin("/epoch/register");
      return fail("Redirecting to GitHub…");
    }
    const { data, error } = await sb().rpc("register_profile", { p_name: name });
    if (error) return fail(error.message);
    return { ok: true, profile: toProfile(data as Row) };
  },

  async signOut() { await sb().auth.signOut(); },

  async scanBooth(boothId) {
    const { data, error } = await sb().rpc("scan_booth", { p_booth: boothId });
    if (error) return fail(error.message);
    if (!data.ok) return fail(data.error);
    const booth = (await this.booths()).find((b) => b.id === boothId)!;
    return { ok: true, delta: data.delta, balance: data.balance, booth };
  },

  async redeem(rewardId) {
    const { data, error } = await sb().rpc("redeem_reward", { p_reward: rewardId });
    if (error) return fail(error.message);
    if (!data.ok) return fail(data.error);
    const reward = (await this.rewards()).find((r) => r.id === rewardId)!;
    return { ok: true, balance: data.balance, reward };
  },

  // throws when offline, so the wallet keeps showing the copy it saved last time
  async history() {
    const { data, error } = await sb().from("txs").select("*").order("at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return (data as TxRow[]).map(toTx);
  },

  async leaderboard(limit = 20) {
    const { data } = await sb().from("leaderboard").select("*").order("earned", { ascending: false }).limit(limit);
    return data ?? [];
  },

  async booths() { const { data } = await sb().from("booths").select("*").order("kind", { ascending: false }).order("name"); return (data ?? []) as Booth[]; },
  async rewards() { const { data } = await sb().from("rewards").select("*").order("cost"); return (data ?? []) as Reward[]; },

  async issueTicket(userId) {
    const { data, error } = await sb().rpc("issue_ticket", { p_user: userId, p_coins: EPOCH.starterCoins });
    if (error) return fail(error.message);
    if (!data.ok) return fail(data.error);
    const profile = await this.lookup(userId);
    return profile ? { ok: true, profile } : fail("Credited, but couldn't reload the profile.");
  },

  async award(userId, delta, reason) {
    const r = await call("award_coins", { p_user: userId, p_delta: delta, p_reason: reason });
    if (!r.ok) return r;
    const profile = await this.lookup(userId);
    return profile ? { ok: true, profile } : fail("Awarded, but couldn't reload the profile.");
  },

  async staffScan(userId, boothId) {
    const r = await call<{ delta: number; balance: number }>("staff_scan", { p_user: userId, p_booth: boothId });
    if (!r.ok) return r;
    const booth = (await this.booths()).find((b) => b.id === boothId)!;
    return { ok: true, delta: r.delta, balance: r.balance, booth };
  },

  reverse: (txId, reason) => call<{ delta: number; balance: number }>("reverse_tx", { p_tx: Number(txId), p_reason: reason }),

  async staffHistory(userId) { const { data } = await sb().rpc("staff_txs", { p_user: userId }); return ((data ?? []) as TxRow[]).map(toTx); },

  async search(q) { const { data } = await sb().rpc("find_attendees", { p_q: q }); return ((data ?? []) as Row[]).map(toProfile); },

  async staff() { const { data } = await sb().from("profiles").select("*").in("role", ["volunteer", "admin"]).order("name").limit(500); return ((data ?? []) as Row[]).map(toProfile); },

  setRole: (handle, role) => call("set_role", { p_handle: handle, p_role: role }),
  assignBooth: (handle, booth) => call("assign_booth", { p_handle: handle, p_booth: booth ?? "" }),

  async audit(filter = {}) {
    let q = sb().from("audit_log").select("*").order("at", { ascending: false }).limit(500);
    if (filter.action) q = q.eq("action", filter.action);
    const who = filter.who?.trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_-]/g, ""); // usernames only, so the filter can't be bent
    if (who) q = q.or(`actor_handle.ilike.*${who}*,target_handle.ilike.*${who}*`);
    const { data } = await q;
    return (data ?? []).map((e): AuditEntry => ({ id: String(e.id), at: e.at, actor: e.actor_handle, action: e.action, target: e.target_handle, booth: e.booth, amount: e.amount, detail: e.detail }));
  },

  async joinRequests() {
    const { data } = await sb().from("join_requests").select("*").order("created_at", { ascending: false }).limit(1000);
    return (data ?? []).map((r) => ({ id: String(r.id), handle: r.handle, email: r.email, firstEvent: r.first_event, createdAt: r.created_at }));
  },

  async feedback() {
    const { data } = await sb().from("event_feedback").select("*").order("created_at", { ascending: false }).limit(1000);
    return (data ?? []).map((f) => ({ id: String(f.id), event: f.event, rating: f.rating, liked: f.liked ?? "", improve: f.improve ?? "", createdAt: f.created_at }));
  },

  async messages() {
    const { data } = await sb().from("messages").select("*").order("created_at", { ascending: false }).limit(500);
    return (data ?? []).map((m) => ({ id: String(m.id), kind: m.kind, name: m.name, email: m.email, handle: m.handle ?? "", message: m.message, createdAt: m.created_at }));
  },

  async epochInterestCount() {
    const { count, error } = await sb().from("epoch_interest").select("id", { count: "exact", head: true }).eq("unsubscribed", false);
    return error ? null : count ?? 0;
  },

  async broadcast(subject, message, audience = "members") {
    const { data: { session } } = await sb().auth.getSession();
    if (!session) return fail("Sign in first.");
    try {
      const r = await fetch("/api/broadcast", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ subject, message, audience }) });
      const j = await r.json();
      return j.ok ? { ok: true, sent: j.sent, failed: j.failed, total: j.total } : fail(j.error ?? "Couldn't send.");
    } catch { return fail("Network error — nothing was sent."); }
  },

  async lookup(userId) {
    const { data } = await sb().from("profiles").select("*").eq("id", userId).maybeSingle();
    return data ? toProfile(data as Row) : null;
  },
};
