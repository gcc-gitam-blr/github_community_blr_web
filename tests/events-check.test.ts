/* The reminder about upcoming events with no approved proposal behind them. */
import { eventsMissingProposal, warningFor } from "../lib/events-check";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const events = [
  { title: "Past workshop", date: "2026-10-12" },
  { title: "Today's session", date: "2026-10-17" },
  { title: "Later, approved", date: "2026-11-02", proposalId: 4 },
  { title: "Later, no number", date: "2026-11-20" },
  { title: "Epoch", date: "2026-12-01", dateLabel: "December 2026", proposalId: null },
];
const missing = eventsMissingProposal(events, "2026-10-17");
ok("past events are ignored; today's counts as upcoming", !missing.some((e) => e.title === "Past workshop") && missing.some((e) => e.title === "Today's session"));
ok("an event with a proposal number is fine, an empty or null one is not", !missing.some((e) => e.title === "Later, approved") && missing.some((e) => e.title === "Epoch"));
ok("they come soonest first", missing.map((e) => e.title).join() === "Today's session,Later, no number,Epoch");
ok("the warning names the event and what to do; a date label wins over the date", warningFor(events[4]).includes("December 2026") && warningFor(events[3]).includes("Event proposals"));
console.log(fails ? `\n${fails} FAILED` : "\nall events-check checks passed"); process.exit(fails ? 1 : 0);
