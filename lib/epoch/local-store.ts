import { EPOCH, SEED_REWARDS, SEED_STALLS } from "./config";
import type { EpochStore, Profile, Result, Reward, Stall, Tx } from "./types";

/* Demo store: everything lives in this browser's localStorage. It is meant for
   trying the flow on one device (register several accounts, scan between them).
   For the real fest, use the Supabase store — see supabase/schema.sql. */

const K = { users: "epoch:users", txs: "epoch:txs", me: "epoch:me", stock: "epoch:stock" };

const read = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

const users = () => read<Record<string, Profile>>(K.users, {});
const txs = () => read<Tx[]>(K.txs, []);

function credit(u: Profile, delta: number, reason: string, ref: string): Tx {
  u.coins += delta;
  if (delta > 0) u.earned += delta;
  const tx: Tx = { id: uid(), userId: u.id, delta, reason, ref, at: new Date().toISOString() };
  write(K.txs, [tx, ...txs()]);
  return tx;
}

export const localStore: EpochStore = {
  mode: "local",

  async me() {
    const id = read<string | null>(K.me, null);
    return id ? users()[id] ?? null : null;
  },

  async register({ handle, name, email }) {
    const all = users();
    const h = handle.trim().replace(/^@/, "").toLowerCase();
    const existing = Object.values(all).find((u) => u.handle.toLowerCase() === h);
    if (existing) { write(K.me, existing.id); return { ok: true, profile: existing }; } // "log back in"
    const profile: Profile = { id: uid(), handle: h, name: name.trim(), email: email.trim(), coins: 0, earned: 0, role: "attendee", createdAt: new Date().toISOString() };
    credit(profile, EPOCH.welcomeCoins, "Welcome bonus", "signup");
    all[profile.id] = profile; write(K.users, all); write(K.me, profile.id);
    return { ok: true, profile };
  },

  async signOut() { try { localStorage.removeItem(K.me); } catch { /* noop */ } },

  async scanStall(stallId) {
    const all = users(); const meId = read<string | null>(K.me, null);
    const me = meId ? all[meId] : null;
    if (!me) return { ok: false, error: "Register first to start earning." };
    const stall = SEED_STALLS.find((s) => s.id === stallId);
    if (!stall) return { ok: false, error: "That QR code isn't an Epoch stall." };
    if (txs().some((t) => t.userId === me.id && t.ref === `stall:${stall.id}`)) return { ok: false, error: `You've already used ${stall.name}.` };
    const delta = stall.kind === "earn" ? stall.coins : -stall.coins;
    if (me.coins + delta < 0) return { ok: false, error: `Not enough coins — you need ${stall.coins}, you have ${me.coins}.` };
    credit(me, delta, stall.name, `stall:${stall.id}`);
    all[me.id] = me; write(K.users, all);
    return { ok: true, delta, balance: me.coins, stall };
  },

  async redeem(rewardId) {
    const all = users(); const meId = read<string | null>(K.me, null);
    const me = meId ? all[meId] : null;
    if (!me) return { ok: false, error: "Register first." };
    const stock = read<Record<string, number>>(K.stock, {});
    const reward = SEED_REWARDS.find((r) => r.id === rewardId);
    if (!reward) return { ok: false, error: "Reward not found." };
    const left = stock[reward.id] ?? reward.stock;
    if (left <= 0) return { ok: false, error: "Sold out — you were too slow." };
    if (me.coins < reward.cost) return { ok: false, error: `You need ${reward.cost - me.coins} more coins.` };
    credit(me, -reward.cost, `Redeemed ${reward.name}`, `reward:${reward.id}`);
    stock[reward.id] = left - 1; write(K.stock, stock);
    all[me.id] = me; write(K.users, all);
    return { ok: true, balance: me.coins, reward: { ...reward, stock: left - 1 } };
  },

  async history() {
    const meId = read<string | null>(K.me, null);
    return txs().filter((t) => t.userId === meId);
  },

  async leaderboard(limit = 20) {
    return Object.values(users()).sort((a, b) => b.earned - a.earned).slice(0, limit).map(({ id, handle, name, earned }) => ({ id, handle, name, earned }));
  },

  async stalls(): Promise<Stall[]> { return SEED_STALLS; },

  async rewards(): Promise<Reward[]> {
    const stock = read<Record<string, number>>(K.stock, {});
    return SEED_REWARDS.map((r) => ({ ...r, stock: stock[r.id] ?? r.stock }));
  },

  async award(userId, delta, reason): Promise<Result<{ profile: Profile }>> {
    const all = users(); const meId = read<string | null>(K.me, null);
    if (!meId || all[meId]?.role === "attendee") return { ok: false, error: "Organiser access required." };
    const target = all[userId];
    if (!target) return { ok: false, error: "Unknown attendee QR." };
    if (target.coins + delta < 0) return { ok: false, error: "That would take the balance below zero." };
    credit(target, delta, reason || "Organiser award", "admin");
    all[target.id] = target; write(K.users, all);
    return { ok: true, profile: target };
  },

  async lookup(userId) { return users()[userId] ?? null; },

  async elevate(code) {
    const all = users(); const meId = read<string | null>(K.me, null);
    if (!meId || !all[meId]) return { ok: false, error: "Register first." };
    if (code.trim() !== EPOCH.organiserCode) return { ok: false, error: "Wrong organiser code." };
    all[meId].role = "admin"; write(K.users, all);
    return { ok: true };
  },
};
