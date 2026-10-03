import type { Profile, Tx } from "./types";

/* Who may do what at Epoch, and what a reversal does. The demo store follows these directly; the live
   database has the same rules in supabase/schema.sql (staff_scan, reverse_tx), and both are tested. */

export const SPEND_COOLDOWN_S = 20; // stops an accidental double-scan charging twice
export const REVERSE_WINDOW_MIN = 15; // how long a booth's volunteer can undo a scan there; after that, an admin

export type TxKind = "ticket" | "recharge" | "booth" | "merch" | "award" | "reversal";
export const txKind = (ref: string): TxKind =>
  ref.startsWith("reverse:") ? "reversal" : ref === "ticket" ? "ticket" : ref.startsWith("booth:recharge-") ? "recharge" : ref.startsWith("booth:") ? "booth" : ref.startsWith("reward:") ? "merch" : "award";
/** The booth a transaction happened at, also for its reversal. */
export const boothOf = (ref: string) => /^(?:reverse:)?booth:(.+)$/.exec(ref)?.[1] ?? null;

type Staff = Pick<Profile, "role" | "booth">;
export const isStaff = (p?: Pick<Profile, "role"> | null) => !!p && p.role !== "attendee";

/** Scanning a wallet for a booth: admins at any booth, a volunteer only at their own. Null = allowed. */
export function scanBlock(me: Staff | null | undefined, boothId: string): string | null {
  if (!me || !isStaff(me)) return "Organiser access required.";
  if (me.role === "admin" || me.booth === boothId) return null;
  return me.booth ? "You can only scan for your own booth." : "You're on the desk, so you can check people in. Ask an admin to give you a booth.";
}

/** Reversing a transaction. Admins: anything but a reversal. A volunteer: a scan at their own booth, within 15 minutes. Null = allowed. */
export function reverseBlock(me: Staff | null | undefined, tx: Tx, now = Date.now()): string | null {
  if (!me || !isStaff(me)) return "Organiser access required.";
  if (tx.ref.startsWith("reverse:")) return "A reversal can't be reversed. Ask an admin to award or deduct instead.";
  if (tx.reversedAt) return "Already reversed.";
  if (me.role === "volunteer") {
    if (!me.booth || tx.ref !== `booth:${me.booth}`) return "You can only reverse scans at your own booth. Ask an admin.";
    if (now - new Date(tx.at).getTime() > REVERSE_WINDOW_MIN * 60_000) return `That was more than ${REVERSE_WINDOW_MIN} minutes ago. Ask an admin.`;
  }
  return null;
}

/** What reversing `tx` does: the opposite amount; earnings (recharges, awards) come off the leaderboard;
    a check-in sets the ticket back to pending; a shop item goes back in stock. The recharge point stays used. */
export function reversal(tx: Tx) {
  return {
    delta: -tx.delta,
    earned: tx.delta > 0 && tx.ref !== "ticket" ? -tx.delta : 0,
    unticket: tx.ref === "ticket",
    restock: tx.ref.startsWith("reward:") ? tx.ref.slice(7) : null,
  };
}
