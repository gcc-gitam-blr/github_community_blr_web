import { BOOTHS, EPOCH, REWARDS, STARTER_COINS } from "./config";
import { SPEND_COOLDOWN_S, isStaff, reversal, reverseBlock, scanBlock } from "./rules";
import type { AuditAction, AuditEntry, Booth, EpochStore, Profile, Result, Reward, Tx } from "./types";

/* Demo store: everything lives in this browser's localStorage. It is meant for trying the flow on one device
   (register several accounts, scan between them). The rules match the database (lib/epoch/rules.ts).
   For the real fest, use the Supabase store — see supabase/schema.sql. */

const K = { users: "epoch:users", txs: "epoch:txs", me: "epoch:me", stock: "epoch:stock", audit: "epoch:audit" };

const read = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

const users = () => read<Record<string, Profile>>(K.users, {});
const txs = () => read<Tx[]>(K.txs, []);
const meId = () => read<string | null>(K.me, null);
const byHandle = (all: Record<string, Profile>, h: string) => Object.values(all).find((u) => u.handle.toLowerCase() === h.trim().replace(/^@/, "").toLowerCase());

function credit(u: Profile, delta: number, reason: string, ref: string, countsAsEarned = delta > 0, extra: Partial<Tx> = {}) {
  u.coins += delta;
  if (countsAsEarned && delta > 0) u.earned += delta;
  write(K.txs, [{ id: uid(), userId: u.id, delta, reason, ref, at: new Date().toISOString(), ...extra } satisfies Tx, ...txs()]);
}

/** The audit log: every staff action, as the signed-in organiser. */
function log(action: AuditAction, target: Profile | null, booth: string | null, amount: number | null, detail = "") {
  const actor = users()[meId() ?? ""];
  write(K.audit, [{ id: uid(), at: new Date().toISOString(), actor: actor?.handle ?? "unknown", action, target: target?.handle ?? null, booth, amount, detail } satisfies AuditEntry, ...read<AuditEntry[]>(K.audit, [])]);
}

/** One booth scan's coin rules, for whoever is charged or paid (the attendee themselves, or by the booth's volunteer). */
function boothTx(all: Record<string, Profile>, u: Profile | undefined, boothId: string, staff: boolean): Result<{ delta: number; balance: number; booth: Booth }> {
  const booth = BOOTHS.find((b) => b.id === boothId);
  if (!booth || booth.kind === "free") return { ok: false, error: "That QR code isn't a coin booth." };
  if (!u) return { ok: false, error: staff ? "Unknown attendee QR." : "Register first." };
  if (!u.ticket) return { ok: false, error: staff ? `${u.name}'s ticket hasn't been verified yet — send them to the registration desk.` : "Your ticket hasn't been verified yet — visit the registration desk." };
  const mine = txs().filter((t) => t.userId === u.id && t.ref === `booth:${booth.id}`);

  let delta: number;
  if (booth.kind === "recharge") {
    if (mine.length) return { ok: false, error: staff ? `${u.name} has already used ${booth.name}. One attempt per recharge point.` : `You've already used ${booth.name}. One attempt per recharge point.` };
    delta = booth.coins;
  } else {
    if (mine[0] && Date.now() - new Date(mine[0].at).getTime() < SPEND_COOLDOWN_S * 1000) return { ok: false, error: "Just scanned — wait a few seconds before paying again." };
    if (u.coins < booth.coins) return { ok: false, error: staff ? `Not enough coins — ${u.name} has ${u.coins}.` : `Not enough coins — ${booth.name} costs ${booth.coins}, you have ${u.coins}. Try a recharge point!` };
    delta = -booth.coins;
  }
  credit(u, delta, booth.name, `booth:${booth.id}`);
  all[u.id] = u; write(K.users, all);
  return { ok: true, delta, balance: u.coins, booth };
}

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

  async scanBooth(boothId) { const all = users(); return boothTx(all, all[meId() ?? ""], boothId, false); },

  async staffScan(userId, boothId) {
    const all = users(); const block = scanBlock(all[meId() ?? ""], boothId);
    if (block) return { ok: false, error: block };
    const r = boothTx(all, all[userId], boothId, true);
    if (r.ok) log("scan", all[userId], boothId, r.delta);
    return r;
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
    credit(t, STARTER_COINS, `Check-in → ${STARTER_COINS} ${EPOCH.currency}`, "ticket", false);
    all[t.id] = t; write(K.users, all);
    log("ticket", t, null, STARTER_COINS);
    return { ok: true, profile: t };
  },

  async award(userId, delta, reason): Promise<Result<{ profile: Profile }>> {
    const all = users();
    if (all[meId() ?? ""]?.role !== "admin") return { ok: false, error: "Only admins can award or deduct coins." };
    const t = all[userId];
    if (!t) return { ok: false, error: "Unknown attendee QR." };
    if (t.coins + delta < 0) return { ok: false, error: "That would take the balance below zero." };
    credit(t, delta, reason || "Organiser award", "admin");
    all[t.id] = t; write(K.users, all);
    log("award", t, null, delta, reason || "Organiser award");
    return { ok: true, profile: t };
  },

  async reverse(txId, reason) {
    const all = users(); const list = txs(); const o = list.find((t) => t.id === txId);
    if (!o) return isStaff(all[meId() ?? ""]) ? { ok: false, error: "Transaction not found." } : { ok: false, error: "Organiser access required." };
    const block = reverseBlock(all[meId() ?? ""], o);
    if (block) return { ok: false, error: block };
    const t = all[o.userId]; const r = reversal(o);
    if (!t) return { ok: false, error: "Unknown attendee." };
    if (t.coins + r.delta < 0) return { ok: false, error: `${t.name} has already spent those coins (balance ${t.coins}), so it can't be reversed.` };
    o.reversedAt = new Date().toISOString(); write(K.txs, list);
    credit(t, r.delta, `Reversed: ${o.reason}`, `reverse:${o.ref}`, false, { reverses: o.id });
    t.earned = Math.max(0, t.earned + r.earned);
    if (r.unticket) t.ticket = false;
    if (r.restock) { const stock = read<Record<string, number>>(K.stock, {}); stock[r.restock] = (stock[r.restock] ?? REWARDS.find((x) => x.id === r.restock)?.stock ?? 0) + 1; write(K.stock, stock); }
    all[t.id] = t; write(K.users, all);
    log("reverse", t, o.ref.startsWith("booth:") ? o.ref.slice(6) : null, r.delta, o.reason + (reason.trim() ? ` — ${reason.trim()}` : ""));
    return { ok: true, delta: r.delta, balance: t.coins };
  },

  async staffHistory(userId) {
    const me = users()[meId() ?? ""];
    if (!isStaff(me) || (me.role === "volunteer" && !me.booth)) return [];
    return txs().filter((t) => t.userId === userId && (me.role === "admin" || t.ref === `booth:${me.booth}` || t.ref === `reverse:booth:${me.booth}`)).slice(0, 30);
  },

  async search(q) {
    const all = users(); const s = q.trim().replace(/^@/, "").toLowerCase();
    if (!isStaff(all[meId() ?? ""]) || s.length < 2) return [];
    return Object.values(all).filter((u) => [u.name, u.handle, u.email].some((f) => f.toLowerCase().includes(s)))
      .sort((a, b) => Number(b.handle === s) - Number(a.handle === s) || a.name.localeCompare(b.name)).slice(0, 20);
  },

  async staff() { const all = users(); return isStaff(all[meId() ?? ""]) ? Object.values(all).filter(isStaff) : []; },

  async setRole(handle, role) {
    const all = users(); const me = all[meId() ?? ""];
    if (me?.role !== "admin") return { ok: false, error: "Only admins can change roles." };
    const t = byHandle(all, handle);
    if (t?.id === me.id) return { ok: false, error: "You can't change your own role — ask another admin." };
    if (!t) return { ok: false, error: "Nobody with that GitHub username has registered yet." };
    t.role = role; if (role === "attendee") t.booth = null; // losing organiser access also takes them off their booth
    write(K.users, all); log("role", t, null, null, role);
    return { ok: true };
  },

  async assignBooth(handle, booth) {
    const all = users();
    if (all[meId() ?? ""]?.role !== "admin") return { ok: false, error: "Only admins can assign booths." };
    if (booth && !BOOTHS.some((b) => b.id === booth && b.kind !== "free")) return { ok: false, error: "That isn't a coin booth." };
    const t = byHandle(all, handle);
    if (!t) return { ok: false, error: "Nobody with that GitHub username has registered yet." };
    if (!isStaff(t)) return { ok: false, error: `@${t.handle} isn't a volunteer yet. Give them the volunteer role first.` };
    t.booth = booth || null; write(K.users, all); log("booth", t, booth || null, null, booth || "desk");
    return { ok: true };
  },

  async audit(filter = {}) {
    if (users()[meId() ?? ""]?.role !== "admin") return [];
    const who = filter.who?.trim().replace(/^@/, "").toLowerCase();
    return read<AuditEntry[]>(K.audit, []).filter((e) => (!filter.action || e.action === filter.action) && (!who || e.actor.toLowerCase().includes(who) || !!e.target?.toLowerCase().includes(who))).slice(0, 500);
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
