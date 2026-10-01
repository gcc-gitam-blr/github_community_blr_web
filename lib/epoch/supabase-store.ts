import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EPOCH } from "./config";
import type { Booth, EpochStore, Profile, Reward, Tx } from "./types";

let client: SupabaseClient | null = null;
const sb = () => (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));

type Row = { id: string; handle: string; name: string; email: string | null; coins: number; earned: number; ticket: boolean; role: Profile["role"]; created_at: string };
const toProfile = (r: Row): Profile => ({ id: r.id, handle: r.handle, name: r.name, email: r.email ?? "", coins: r.coins, earned: r.earned, ticket: r.ticket, role: r.role, createdAt: r.created_at });
const fail = (error: string) => ({ ok: false as const, error });

export const supabaseStore: EpochStore = {
  mode: "supabase",

  async me() {
    const { data: { user } } = await sb().auth.getUser();
    if (!user) return null;
    const { data } = await sb().from("profiles").select("*").eq("id", user.id).maybeSingle();
    return data ? toProfile(data as Row) : null;
  },

  /* Attendees sign in with GitHub. First call redirects to GitHub; once they're
     back with a session, the same call creates their profile. */
  async register({ name }) {
    const { data: { user } } = await sb().auth.getUser();
    if (!user) {
      await sb().auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${window.location.origin}/epoch/register` } });
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

  async history() {
    const { data } = await sb().from("txs").select("*").order("at", { ascending: false }).limit(100);
    return (data ?? []).map((t): Tx => ({ id: String(t.id), userId: t.user_id, delta: t.delta, reason: t.reason, ref: t.ref, at: t.at }));
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
    const { data, error } = await sb().rpc("award_coins", { p_user: userId, p_delta: delta, p_reason: reason });
    if (error) return fail(error.message);
    if (!data.ok) return fail(data.error);
    const profile = await this.lookup(userId);
    return profile ? { ok: true, profile } : fail("Awarded, but couldn't reload the profile.");
  },

  async joinRequests() {
    const { data } = await sb().from("join_requests").select("*").order("created_at", { ascending: false }).limit(1000);
    return (data ?? []).map((r) => ({ id: String(r.id), handle: r.handle, email: r.email, firstEvent: r.first_event, createdAt: r.created_at }));
  },

  async broadcast(subject, message) {
    const { data: { session } } = await sb().auth.getSession();
    if (!session) return fail("Sign in first.");
    try {
      const r = await fetch("/api/broadcast", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ subject, message }) });
      const j = await r.json();
      return j.ok ? { ok: true, sent: j.sent, failed: j.failed, total: j.total } : fail(j.error ?? "Couldn't send.");
    } catch { return fail("Network error — nothing was sent."); }
  },

  async lookup(userId) {
    const { data } = await sb().from("profiles").select("*").eq("id", userId).maybeSingle();
    return data ? toProfile(data as Row) : null;
  },
};
