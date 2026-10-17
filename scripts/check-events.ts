import fs from "node:fs";
import { eventsMissingProposal, warningFor, type EventLike } from "../lib/events-check";
import { todayIST } from "../lib/admin/appointments";

/* npm run check:events: warns about upcoming events with no proposal number. Always exits 0 (it is a reminder). */
const { events } = JSON.parse(fs.readFileSync("content/club/events.json", "utf8")) as { events: EventLike[] };
const missing = eventsMissingProposal(events, todayIST());
for (const e of missing) console.log(process.env.GITHUB_ACTIONS ? `::warning file=content/club/events.json::${warningFor(e)}` : `warning: ${warningFor(e)}`);
console.log(missing.length ? `${missing.length} upcoming ${missing.length === 1 ? "event has" : "events have"} no proposal number.` : "Every upcoming event has a proposal number.");
