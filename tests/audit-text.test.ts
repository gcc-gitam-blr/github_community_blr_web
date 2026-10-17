/* The activity log in plain words. */
import { describe, entityLabel } from "../lib/admin/audit";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
ok("a known action reads as a sentence with its id", describe({ action: "proposal_approved", entity: "proposal", entity_id: "12", detail: {} }) === "Approved an event (#12)");
ok("states and dates are added", describe({ action: "appointment_granted", entity: "appointment", entity_id: "4", detail: { role: "core", ends_on: "2027-04-30" } }) === "Gave access (#4) · core, until 2027-04-30");
ok("a move shows from and to", describe({ action: "application_moved", entity: "application", entity_id: "9", detail: { from: "submitted", to: "screening" } }) === "Moved an application (#9) · submitted → screening");
ok("checklist states read naturally; versions and counts too", describe({ action: "checklist_changed", entity: "proposal", entity_id: "3", detail: { item: 5, state: "na" } }).endsWith("not needed") && describe({ action: "policy_published", entity: "policy", entity_id: "2", detail: { version: 3 } }).endsWith("version 3") && describe({ action: "export", entity: "members", entity_id: null, detail: { count: 40 } }) === "Downloaded a list · 40 rows");
ok("long ids (people) are shortened; unknown actions still read fine", describe({ action: "member_created", entity: "member", entity_id: "00000000-0000-0000-0000-000000000009", detail: {} }) === "Added a member (#00000000)" && describe({ action: "some_new_thing", entity: "x", entity_id: null, detail: {} }) === "Some new thing");
ok("entity names are friendly, unknown ones tidy", entityLabel("proposal") === "Event proposals" && entityLabel("pending_role") === "Invitations" && entityLabel("odd_one") === "odd one");
console.log(fails ? `\n${fails} FAILED` : "\nall audit text checks passed"); process.exit(fails ? 1 : 0);
