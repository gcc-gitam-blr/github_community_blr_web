import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EPOCH } from "./config";
import type { EpochStore, Profile, Reward, Stall, Tx } from "./types";

let client: SupabaseClient | null = null;
const sb = () => (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));

type Row = { id: string; handle: string; name: string; email: string | null; coins: number; earned: number; role: Profile["role"]; created_at: string };
const toProfile = (r: Row): Profile => ({ id: r.id, handle: r.handle, name: r.name, email: r.email ?? "", coins: r.coins, earned: r.earned, role: r.role, createdAt: r.created_at });
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
     back with a session, the same call creates their profile + welcome coins. */
  async register({ name }) {
    const { data: { user } } = await sb().auth.getUser();
    if (!user) {
      await sb().auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${window.location.origin}/epoch/register` } });
      return fail("Redirecting to GitHub…");
    }
    const { data, error } = await sb().rpc("register_profile", { p_name: name, p_welcome: EPOCH.welcomeCoins });
    if (error) return fail(error.message);
    return { ok: true, profile: toProfile(data as Row) };
  },

  async signOut() { await sb().auth.signOut(); },

  async scanStall(stallId) {
    const { data, error } = await sb().rpc("scan_stall", { p_stall: stallId });
    if (error) return fail(error.message);
    if (!data.ok) return fail(data.error);
    const stall = (await this.stalls()).find((s) => s.id === stallId)!;
    return { ok: true, delta: data.delta, balance: data.balance, stall };
  },

  async redeem(rewardId) {
    const { data, error } = await sb().rpc("redeem_reward", { p_reward: rewardId });
    if (error) return fail(error.message);
    if (!data.ok) return fail(data.error);
    const reward = (await this.rewards()).find((r) => r.id === rewardId)!;
    return { ok: true, balance: data.balance, reward };
  },

  async history() {
    const { data } = await sb().from("txs").select("*").order("at", { ascending: false }).limit(50);
    return (data ?? []).map((t): Tx => ({ id: String(t.id), userId: t.user_id, delta: t.delta, reason: t.reason, ref: t.ref, at: t.at }));
  },

  async leaderboard(limit = 20) {
    const { data } = await sb().from("leaderboard").select("*").order("earned", { ascending: false }).limit(limit);
    return data ?? [];
  },

  async stalls() { const { data } = await sb().from("stalls").select("*").order("kind").order("name"); return (data ?? []) as Stall[]; },
  async rewards() { const { data } = await sb().from("rewards").select("*").order("cost"); return (data ?? []) as Reward[]; },

  async award(userId, delta, reason) {
    const { data, error } = await sb().rpc("award_coins", { p_user: userId, p_delta: delta, p_reason: reason });
    if (error) return fail(error.message);
    if (!data.ok) return fail(data.error);
    const profile = await this.lookup(userId);
    return profile ? { ok: true, profile } : fail("Awarded, but couldn't reload the profile.");
  },

  async lookup(userId) {
    const { data } = await sb().from("profiles").select("*").eq("id", userId).maybeSingle();
    return data ? toProfile(data as Row) : null;
  },
};
