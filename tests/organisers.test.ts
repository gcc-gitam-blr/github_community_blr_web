// The Epoch organiser rules in demo mode (the browser's localStorage), the same as tests/schema.test.ts checks in the
// database: volunteers limited to their booth, reversals, attendee search and the audit log.
const mem: Record<string, string> = {};
(globalThis as unknown as { localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> }).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } };
import { localStore as s } from "../lib/epoch/local-store";
import { EPOCH } from "../lib/epoch/config";
import { reverseBlock, scanBlock, txKind, boothOf } from "../lib/epoch/rules";
import type { Tx } from "../lib/epoch/types";
let fails = 0; const ok = (name: string, cond: boolean) => { console.log((cond ? "PASS" : "FAIL") + "  " + name); if (!cond) fails++; };

const as = async (h: string) => { const r = await s.register({ handle: h, name: h, email: `${h}@x.io` }); if (!r.ok) throw new Error(r.error); return r.profile.id; };
const coins = async (id: string) => (await s.lookup(id))!.coins;
const txs = () => JSON.parse(mem["epoch:txs"] ?? "[]") as Tx[];
const last = (user: string, ref: string) => txs().find((t) => t.userId === user && t.ref === ref)!;
const age = (id: string, minutes: number) => { const all = txs(); all.find((t) => t.id === id)!.at = new Date(Date.now() - minutes * 60_000).toISOString(); mem["epoch:txs"] = JSON.stringify(all); };

(async () => {
  // the shared rules, on their own
  ok("transactions are told apart by their ref", txKind("ticket") === "ticket" && txKind("booth:recharge-git") === "recharge" && txKind("booth:vr") === "booth" && txKind("reward:tee") === "merch" && txKind("admin") === "award" && txKind("reverse:booth:vr") === "reversal");
  ok("a reversal still belongs to its booth", boothOf("reverse:booth:vr") === "vr" && boothOf("booth:vr") === "vr" && boothOf("ticket") === null);
  ok("a desk volunteer is told to ask for a booth", /on the desk/.test(scanBlock({ role: "volunteer", booth: null }, "vr") ?? ""));
  ok("admins scan for any booth; a volunteer only their own", scanBlock({ role: "admin" }, "vr") === null && scanBlock({ role: "volunteer", booth: "vr" }, "vr") === null && !!scanBlock({ role: "volunteer", booth: "vr" }, "retro"));
  const t0: Tx = { id: "1", userId: "u", delta: -40, reason: "VR", ref: "booth:vr", at: new Date().toISOString() };
  ok("a volunteer can reverse a fresh scan at their booth", reverseBlock({ role: "volunteer", booth: "vr" }, t0) === null);
  ok("…but not after 15 minutes", /15 minutes/.test(reverseBlock({ role: "volunteer", booth: "vr" }, t0, Date.now() + 16 * 60_000) ?? ""));

  const admin = await as("org"); await s.elevate!(EPOCH.organiserCode);
  const vol = await as("vol"), desk = await as("desk"), rec = await as("rec"), bea = await as("bea"), cy = await as("cy");
  ok("an attendee can't hand out roles", !(await s.setRole("vol", "volunteer")).ok);
  await as("org");
  for (const h of ["vol", "desk", "rec"]) await s.setRole(h, "volunteer");
  ok("admins can't change their own role", /own role/.test(((await s.setRole("org", "attendee")) as { error: string }).error));
  ok("an attendee can't be put on a booth", /volunteer role first/.test(((await s.assignBooth("bea", "vr")) as { error: string }).error));
  ok("a free booth can't be assigned", !(await s.assignBooth("vol", "startup")).ok);
  ok("an admin puts volunteers on their booths", (await s.assignBooth("vol", "vr")).ok && (await s.assignBooth("@REC", "recharge-puzzle")).ok && (await s.lookup(vol))!.booth === "vr");

  await as("desk");
  ok("a desk volunteer checks a ticket in", (await s.issueTicket(bea)).ok && (await coins(bea)) === 398);
  ok("…but can't scan for a booth", /on the desk/.test(((await s.staffScan(bea, "vr")) as { error: string }).error));
  ok("volunteers can't award coins", !(await s.award(bea, 50, "prize")).ok && (await coins(bea)) === 398);
  ok("a desk volunteer sees none of an attendee's ledger", (await s.staffHistory(bea)).length === 0);
  await as("vol");
  ok("a booth volunteer can check people in too", (await s.issueTicket(cy)).ok);
  ok("a volunteer can't scan for someone else's booth", /own booth/.test(((await s.staffScan(bea, "retro")) as { error: string }).error));
  const vr = await s.staffScan(bea, "vr");
  ok("the VR volunteer charges Bea from her wallet → 358", vr.ok && vr.delta === -40 && (await coins(bea)) === 358);
  ok("the 20-second double-scan guard applies", !(await s.staffScan(bea, "vr")).ok && (await coins(bea)) === 358);
  const vrTx = last(bea, "booth:vr");
  ok("the volunteer sees only their booth's lines", (await s.staffHistory(bea)).every((t) => t.ref.endsWith("booth:vr")));
  const back = await s.reverse(vrTx.id, "headset broke");
  ok("…and reverses the charge → 398", back.ok && back.delta === 40 && (await coins(bea)) === 398);
  ok("the original stays, marked reversed, next to its reversal", !!last(bea, "booth:vr").reversedAt && last(bea, "reverse:booth:vr").reverses === vrTx.id);
  ok("the same transaction can't be reversed twice", /Already reversed/.test(((await s.reverse(vrTx.id, "")) as { error: string }).error) && (await coins(bea)) === 398);
  ok("a reversal can't itself be reversed", /can't be reversed/.test(((await s.reverse(last(bea, "reverse:booth:vr").id, "")) as { error: string }).error));

  await as("bea"); await s.scanBooth("retro");
  ok("attendees can't reverse", !(await s.reverse(last(bea, "booth:retro").id, "")).ok);
  await as("vol");
  ok("a volunteer can't reverse another booth's charge", /own booth/.test(((await s.reverse(last(bea, "booth:retro").id, "")) as { error: string }).error));
  age(last(bea, "booth:vr").id, 1); age(last(bea, "reverse:booth:vr").id, 1);
  await s.staffScan(bea, "vr"); const oldVr = last(bea, "booth:vr"); age(oldVr.id, 16);
  ok("a volunteer can't reverse after 15 minutes", /15 minutes/.test(((await s.reverse(oldVr.id, "")) as { error: string }).error));
  await as("org");
  ok("an admin still can", (await s.reverse(oldVr.id, "")).ok);

  await as("rec");
  const paid = await s.staffScan(bea, "recharge-puzzle");
  ok("the puzzle volunteer pays Bea +20 once she passes", paid.ok && paid.delta === 20 && (await s.lookup(bea))!.earned === 20);
  const before = await coins(bea);
  ok("reversing a payout takes the 20 back, and off the leaderboard", (await s.reverse(last(bea, "booth:recharge-puzzle").id, "")).ok && (await coins(bea)) === before - 20 && (await s.lookup(bea))!.earned === 0);
  ok("…and the point stays used", !(await s.staffScan(bea, "recharge-puzzle")).ok);

  await as("bea"); await s.redeem("tee");
  const stock = async () => (await s.rewards()).find((r) => r.id === "tee")!.stock;
  const s0 = await stock();
  await as("vol");
  ok("a volunteer can't reverse shop purchases", !(await s.reverse(last(bea, "reward:tee").id, "")).ok);
  await as("org");
  ok("an admin reverses a shop purchase: coins back, the tee back in stock", (await s.reverse(last(bea, "reward:tee").id, "wrong size")).ok && (await stock()) === s0 + 1);
  await s.award(bea, 100, "Quiz winner");
  const users = JSON.parse(mem["epoch:users"]); users[bea].coins = 50; mem["epoch:users"] = JSON.stringify(users); // she spent most of it
  ok("a reversal that would go below zero is refused", /already spent/.test(((await s.reverse(last(bea, "admin").id, "")) as { error: string }).error) && (await coins(bea)) === 50);
  ok("a wrong check-in: an admin reverses Cy's ticket → 0 coins, pending", (await s.reverse(last(cy, "ticket").id, "wrong person")).ok && (await coins(cy)) === 0 && !(await s.lookup(cy))!.ticket);
  ok("…and the desk can verify the right person again, once", (await s.issueTicket(cy)).ok && (await coins(cy)) === 398 && !(await s.issueTicket(cy)).ok);

  await as("desk");
  ok("staff find an attendee by part of a name, email or @handle", (await s.search("be")).some((p) => p.handle === "bea") && (await s.search("cy@x")).length === 1 && (await s.search("@cy"))[0]?.handle === "cy");
  ok("a one-letter search finds nothing", (await s.search("b")).length === 0);
  ok("volunteers can't read the audit log", (await s.audit()).length === 0);
  await as("bea");
  ok("attendees can't search", (await s.search("bea")).length === 0);
  await as("org");
  const log = await s.audit();
  const has = (a: string, by: string, to: string | null, amount?: number) => log.some((e) => e.action === a && e.actor === by && e.target === to && (amount === undefined || e.amount === amount));
  ok("the audit log records check-ins, scans, awards and reversals", has("ticket", "desk", "bea", 398) && has("scan", "vol", "bea", -40) && has("award", "org", "bea", 100) && has("reverse", "vol", "bea", 40) && has("reverse", "rec", "bea", -20));
  ok("…and role and booth changes", has("role", "org", "vol") && log.some((e) => e.action === "booth" && e.target === "vol" && e.booth === "vr"));
  ok("…and filters by action and by person", (await s.audit({ action: "reverse" })).every((e) => e.action === "reverse") && (await s.audit({ who: "@REC" })).every((e) => e.actor === "rec" || e.target === "rec"));
  ok("taking a volunteer's role away takes them off their booth", (await s.setRole("vol", "attendee")).ok && (await s.lookup(vol))!.booth === null);
  ok("the organisers list is staff only", (await s.staff()).every((p) => p.role !== "attendee") && (await s.staff()).some((p) => p.handle === "rec"));
  ok("every balance but Bea's (set by hand) equals the sum of its ledger", [admin, vol, desk, rec, cy].every((id) => txs().filter((t) => t.userId === id).reduce((n, t) => n + t.delta, 0) === JSON.parse(mem["epoch:users"])[id].coins));

  console.log(fails ? `\n${fails} FAILED` : "\nall organiser checks passed");
  process.exit(fails ? 1 : 0);
})();
