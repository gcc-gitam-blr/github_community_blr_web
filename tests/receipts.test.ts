// Wallet receipts: the short reference, where it happened, the balance after each line, and the spent / earned filter.
import { filterTxs, itemName, kindLabel, place, shortRef, withBalances } from "../lib/epoch/receipt";
import type { Tx } from "../lib/epoch/types";
let fails = 0; const ok = (name: string, cond: boolean) => { console.log((cond ? "PASS" : "FAIL") + "  " + name); if (!cond) fails++; };

const tx = (id: string, delta: number, ref: string, extra: Partial<Tx> = {}): Tx => ({ id, userId: "u", delta, reason: ref, ref, at: "2026-12-11T10:00:00+05:30", ...extra });
// newest first, as the wallet gets them
const list = [tx("5", 40, "reverse:booth:vr", { reverses: "3" }), tx("4", 20, "booth:recharge-git"), tx("3", -40, "booth:vr", { reversedAt: "2026-12-11T10:05:00+05:30" }), tx("2", -40, "reward:sticker-pack"), tx("1", 398, "ticket")];

ok("a live id reads as EPC-00042", shortRef("42") === "EPC-00042");
ok("a demo id reads as six capitals", /^EPC-[0-9A-F]{6}$/.test(shortRef("3f9a1c2e-0000-4000-8000-000000000000")) && shortRef("3f9a1c2e-0000") === "EPC-3F9A1C");
ok("where: the booth's name, also for its reversal", place(list[2]) === "Virtual Reality Merge Zone" && place(list[0]) === "Virtual Reality Merge Zone");
ok("where: the desk, the stall and the organisers", place(list[4]) === "Registration desk" && place(list[3]) === "Merchandise Stall" && place(tx("9", 10, "admin")) === "Organiser desk");
ok("each line has a type", ["Reversal", "Recharge point", "Booth", "Merch", "Check-in"].every((l, i) => kindLabel(list[i]) === l) && kindLabel(tx("9", 10, "admin")) === "Award");
ok("a merch line names the item", itemName(list[3]) === "Octocat Sticker Pack" && itemName(list[2]) === undefined);

const full = withBalances(list, 378, true);
ok("the balance after each line, counted from zero", full.map((t) => t.after).join() === "378,338,318,358,398");
const part = withBalances(list.slice(0, 3), 378, false);
ok("…or back from today's balance when the history is cut short", part.map((t) => t.after).join() === "378,338,318");
ok("both ways agree", part.every((t, i) => t.after === full[i].after));

ok("all shows everything", filterTxs(full, "all").length === 5);
ok("earned: only coins in (check-in, recharge, a reversal that gave coins back)", filterTxs(full, "earned").map((t) => t.id).join() === "5,4,1");
ok("spent: only coins out", filterTxs(full, "spent").map((t) => t.id).join() === "3,2");

console.log(fails ? `\n${fails} receipt check(s) failed` : "\nall receipt checks passed");
process.exit(fails ? 1 : 0);
