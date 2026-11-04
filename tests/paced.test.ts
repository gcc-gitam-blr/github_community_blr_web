/* Sending many emails one at a time, a few seconds apart (lib/email/paced.ts). */
import { gapMs, sendPaced } from "../lib/email/paced";
import type { SendResult } from "../lib/email/send";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

(async () => {
  delete process.env.EMAIL_GAP_MS;
  const gaps = Array.from({ length: 200 }, gapMs);
  ok("the pause between emails is 4 to 8 seconds, and not always the same", gaps.every((g) => g >= 4000 && g <= 8000) && new Set(gaps).size > 50);
  process.env.EMAIL_GAP_MS = "0";
  ok("tests can switch the pause off", gapMs() === 0);

  const order: string[] = [], recorded: string[] = [];
  let busy = 0, most = 0;
  const send = async (x: string): Promise<SendResult> => { busy++; most = Math.max(most, busy); order.push(x); await new Promise((r) => setTimeout(r, 5)); busy--; return { sent: true }; };
  const r = await sendPaced(["a", "b", "c", "d"], send, async (x) => { recorded.push(x); }, Date.now() + 10_000);
  ok("everyone is sent to, in order, never two at once", r.sent === 4 && r.left === 0 && order.join() === "a,b,c,d" && most === 1);
  ok("each person is recorded right after their email goes", recorded.join() === "a,b,c,d");

  const stop = await sendPaced(["a", "b", "c"], async (x) => (x === "b" ? { sent: false, reason: "failed", error: "421 try again later", why: "The mail server is slowing us down for now." } : { sent: true }), async () => {}, Date.now() + 10_000);
  ok("the first failure stops the run and says why, leaving the rest for next time", stop.sent === 1 && stop.left === 2 && stop.problem === "The mail server is slowing us down for now.");

  const late = await sendPaced(["a", "b"], send, async () => {}, Date.now() - 1);
  ok("past the time limit it sends nothing more and counts what's left", late.sent === 0 && late.left === 2);

  process.env.EMAIL_GAP_MS = "30";
  const t0 = Date.now();
  const timed = await sendPaced(["a", "b", "c"], async () => ({ sent: true }), async () => {}, Date.now() + 10_000);
  ok("with a pause set, emails are spaced out (no pause after the last one)", timed.sent === 3 && Date.now() - t0 >= 60);
  const cut = await sendPaced(["a", "b", "c"], async () => ({ sent: true }), async () => {}, Date.now() + 40);
  ok("a pause that would run past the limit ends the run instead", cut.sent >= 1 && cut.sent + cut.left === 3 && cut.left >= 1);

  if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
  console.log("\nall paced-sending checks passed");
})();
