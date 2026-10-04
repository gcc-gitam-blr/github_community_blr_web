import { BOOTHS, REWARDS } from "./config";
import { boothOf, txKind } from "./rules";
import type { Tx } from "./types";

/* What a wallet receipt shows: a short reference, where it happened and the balance right after it. */

/** A short reference to read out at the desk: EPC-00042 (live ids are numbers), or EPC-3F9A1C in demo mode. */
export const shortRef = (id: string) => `EPC-${/^\d+$/.test(id) ? id.padStart(5, "0") : id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

/** Where it happened, in words. */
export function place(t: Tx): string {
  const b = boothOf(t.ref);
  if (b) return BOOTHS.find((x) => x.id === b)?.name ?? b;
  const ref = t.ref.replace(/^reverse:/, "");
  if (ref === "ticket") return "Registration desk";
  if (ref.startsWith("reward:")) return "Merchandise Stall";
  return "Organiser desk";
}

export const KIND_LABEL = { ticket: "Check-in", recharge: "Recharge point", booth: "Booth", merch: "Merch", award: "Award", reversal: "Reversal" } as const;
export const kindLabel = (t: Tx) => KIND_LABEL[txKind(t.ref)];
export const itemName = (t: Tx) => (t.ref.startsWith("reward:") ? REWARDS.find((r) => `reward:${r.id}` === t.ref)?.name : undefined);

/** Each transaction (newest first) with the balance right after it. Counted forward from zero when we have the whole
    history (every wallet starts at 0), otherwise back from today's balance. */
export function withBalances(txs: Tx[], balance: number, complete: boolean): (Tx & { after: number })[] {
  if (complete) {
    let run = 0;
    return [...txs].reverse().map((t) => ({ ...t, after: (run += t.delta) })).reverse();
  }
  let after = balance;
  return txs.map((t) => { const row = { ...t, after }; after -= t.delta; return row; });
}

export type TxFilter = "all" | "earned" | "spent";
export const filterTxs = <T extends Tx>(txs: T[], f: TxFilter) => (f === "all" ? txs : txs.filter((t) => (f === "earned" ? t.delta > 0 : t.delta < 0)));
