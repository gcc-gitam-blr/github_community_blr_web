import { BOOTHS, EPOCH, REWARDS, STARTER_COINS } from "./config";
import type { Booth, EpochStore, Profile, Result, Reward, Tx } from "./types";

/* Demo store: everything lives in this browser's localStorage. It is meant for
   trying the flow on one device (register several accounts, scan between them).
   For the real fest, use the Supabase store — see supabase/schema.sql. */

const K = { users: "epoch:users", txs: "epoch:txs", me: "epoch:me", stock: "epoch:stock" };
const SPEND_COOLDOWN_MS = 20_000; // stops an accidental double-scan charging twice

const read = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

const users = () => read<Record<string, Profile>>(K.users, {});
const txs = () => read<Tx[]>(K.txs, []);
const meId = () => read<string | null>(K.me, null);

function credit(u: Profile, delta: number, reason: string, ref: string, countsAsEarned = delta > 0) {
  u.coins += delta;
  if (countsAsEarned && delta > 0) u.earned += delta;
  write(K.txs, [{ id: uid(), userId: u.id, delta, reason, ref, at: new Date().toISOString() } satisfies Tx, ...txs()]);
}

const isStaff = (p?: Profile | null) => !!p && p.role !== "attendee";

export const localStore: EpochStore = {
  mode: "local",

  async me() { const id = meId(); return id ? users()[id] ?? null : null; },

  async register({ handle, name, email }) {
    const all = users();
    const h = handle.trim().replace(/^@/, "").toLowerCase();
    const existing = Object.values(all).find((u) => u.handle.toLowerCase() === h);
    if (existing) { write(K.me, existing.id); return { ok: true, profile: existing }; } // "log back in"
    const profile: Profile = { id: uid(), handle: h, name: name.trim(), email: email.trim(), coins: 0, earned: 0, ticket: false, role: "attendee", createdAt: new Date().toISOString() };
    all[profile.id] = profile; write(K.users, all); write(K.me, profile.id);
    return { ok: true, profile };
  },

  async signOut() { try { localStorage.removeItem(K.me); } catch { /* noop */ } },

  async scanBooth(boothId) {
    const all = users(); const me = meId() ? all[meId()!] : null;
    if (!me) return { ok: false, error: "Register first." };
    const booth = BOOTHS.find((b) => b.id === boothId);
    if (!booth || booth.kind === "free") return { ok: false, error: "That QR code isn't a coin booth." };
    if (!me.ticket) return { ok: false, error: "Your ticket hasn't been verified yet — visit the registration desk." };
    const mine = txs().filter((t) => t.userId === me.id && t.ref === `booth:${booth.id}`);

    let delta: number;
    if (booth.kind === "recharge") {
      if (mine.length) return { ok: false, error: `You've already used ${booth.name}. One attempt per recharge point.` };
      delta = booth.coins;
    } else {
      if (mine[0] && Date.now() - new Date(mine[0].at).getTime() < SPEND_COOLDOWN_MS) return { ok: false, error: "Just scanned — wait a few seconds before paying again." };
      if (me.coins < booth.coins) return { ok: false, error: `Not enough coins — ${booth.name} costs ${booth.coins}, you have ${me.coins}. Try a recharge point!` };
      delta = -booth.coins;
    }
    credit(me, delta, booth.name, `booth:${booth.id}`);
    all[me.id] = me; write(K.users, all);
    return { ok: true, delta, balance: me.coins, booth };
  },

  async redeem(rewardId) {
    const all = users(); const me = meId() ? all[meId()!] : null;
    if (!me) return { ok: false, error: "Register first." };
    const stock = read<Record<string, number>>(K.stock, {});
    const reward = REWARDS.find((r) => r.id === rewardId);
    if (!reward) return { ok: false, error: "Item not found." };
    const left = stock[reward.id] ?? reward.stock;
    if (left <= 0) return { ok: false, error: "Sold out." };
    if (me.coins < reward.cost) return { ok: false, error: `You need ${reward.cost - me.coins} more coins.` };
    credit(me, -reward.cost, `Bought ${reward.name}`, `reward:${reward.id}`);
    stock[reward.id] = left - 1; write(K.stock, stock);
    all[me.id] = me; write(K.users, all);
    return { ok: true, balance: me.coins, reward: { ...reward, stock: left - 1 } };
  },

  async history() { return txs().filter((t) => t.userId === meId()); },

  async leaderboard(limit = 20) {
    return Object.values(users()).filter((u) => u.earned > 0).sort((a, b) => b.earned - a.earned).slice(0, limit).map(({ id, handle, name, earned }) => ({ id, handle, name, earned }));
  },

  async booths(): Promise<Booth[]> { return BOOTHS; },

  async rewards(): Promise<Reward[]> {
    const stock = read<Record<string, number>>(K.stock, {});
    return REWARDS.map((r) => ({ ...r, stock: stock[r.id] ?? r.stock }));
  },

  async issueTicket(userId): Promise<Result<{ profile: Profile }>> {
    const all = users();
    if (!isStaff(all[meId() ?? ""])) return { ok: false, error: "Organiser access required." };
    const t = all[userId];
    if (!t) return { ok: false, error: "Unknown attendee QR." };
    if (t.ticket) return { ok: false, error: `${t.name} already has a verified ticket.` };
    t.ticket = true;
    credit(t, STARTER_COINS, `Ticket ₹${EPOCH.ticketPriceINR} → ${STARTER_COINS} ${EPOCH.currency}`, "ticket", false);
    all[t.id] = t; write(K.users, all);
    return { ok: true, profile: t };
  },

  async award(userId, delta, reason): Promise<Result<{ profile: Profile }>> {
    const all = users();
    if (!isStaff(all[meId() ?? ""])) return { ok: false, error: "Organiser access required." };
    const t = all[userId];
    if (!t) return { ok: false, error: "Unknown attendee QR." };
    if (t.coins + delta < 0) return { ok: false, error: "That would take the balance below zero." };
    credit(t, delta, reason || "Organiser award", "admin");
    all[t.id] = t; write(K.users, all);
    return { ok: true, profile: t };
  },

  async lookup(userId) { return users()[userId] ?? null; },

  async elevate(code) {
    const all = users(); const id = meId();
    if (!id || !all[id]) return { ok: false, error: "Register first." };
    if (code.trim() !== EPOCH.organiserCode) return { ok: false, error: "Wrong organiser code." };
    all[id].role = "admin"; write(K.users, all);
    return { ok: true };
  },
};
