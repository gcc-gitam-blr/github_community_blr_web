/* Plain words for the activity log (crm_audit). The log stores an action name, what it was about, its id and a few states;
   this turns a line into a sentence. Unknown actions still read fine: the underscores become spaces. */
export interface AuditLine { action: string; entity: string; entity_id: string | null; detail: Record<string, unknown> }

const ENTITY: Record<string, string> = {
  appointment: "Access", pending_role: "Invitations", member: "Members", application: "Applications", campaign: "Recruitment rounds", proposal: "Event proposals",
  task: "Tasks", meeting: "Meetings", decision: "Decisions", asset: "Assets", handover: "Handover", policy: "Policies", signups: "Sign-ups", applications: "Applications", members: "Members",
};
export const entityLabel = (e: string) => ENTITY[e] ?? e.replace(/_/g, " ");

const ACTION: Record<string, string> = {
  appointment_granted: "Gave access", appointment_pending: "Invited someone to have access", appointment_ended: "Ended access",
  campaign_created: "Created a recruitment round", campaign_form: "Changed a round's form", recruitment_email: "Emailed applicants", campaign_dates: "Changed a round's dates", campaign_status: "Changed a round's status", reviewer_added: "Added a reviewer", reviewer_removed: "Removed a reviewer",
  application_submitted: "An application came in", application_reviewed: "Reviewed an application", application_moved: "Moved an application", application_decided: "Decided an application", application_onboarded: "Onboarded an applicant as a member",
  member_created: "Added a member", member_updated: "Edited a member", member_status_changed: "Changed a member's status", members_imported: "Imported members", export: "Downloaded a list",
  proposal_created: "Started an event proposal", proposal_details: "Edited a proposal's document", proposal_updated: "Edited an event proposal", proposal_submitted: "Submitted an event proposal", proposal_approved: "Approved an event", proposal_returned: "Returned an event proposal", proposal_rejected: "Rejected an event proposal",
  proposal_cancelled: "Cancelled an event", proposal_completed: "Completed an event", proposal_linked: "Linked an event page", checklist_changed: "Changed a proposal checklist item",
  task_created: "Created a task", task_status: "Moved a task", task_reassigned: "Reassigned a task", meeting_created: "Created a meeting", meeting_details: "Edited a meeting's document details", meeting_updated: "Edited a meeting", attendees_set: "Recorded who was at a meeting",
  minutes_finalised: "Finalised minutes", minutes_note: "Added a note to final minutes", decision_recorded: "Recorded a decision", decision_superseded: "Superseded a decision",
  asset_created: "Added an asset", asset_updated: "Edited an asset", asset_notes: "Updated an asset's notes", handover_started: "Started a handover", handover_item: "Updated a handover step", handover_completed: "Completed the handover",
  policy_created: "Created a policy", policy_owner: "Changed a policy's owner", policy_draft: "Saved a policy draft", policy_draft_discarded: "Threw away a policy draft", policy_published: "Published a policy version",
};

const STATE: Record<string, string> = { done: "done", waived: "waived", open: "reopened", na: "not needed" };
export function describe(l: AuditLine): string {
  const base = ACTION[l.action] ?? (l.action.charAt(0).toUpperCase() + l.action.slice(1).replace(/_/g, " "));
  const d = l.detail ?? {}, bits: string[] = [];
  if (typeof d.role === "string") bits.push(d.role);
  if (typeof d.from === "string" && typeof d.to === "string") bits.push(`${d.from} → ${d.to}`);
  else if (typeof d.to === "string") bits.push(`to ${d.to}`);
  if (typeof d.decision === "string") bits.push(d.decision);
  if (typeof d.state === "string") bits.push(STATE[d.state] ?? d.state);
  if (typeof d.version === "number") bits.push(`version ${d.version}`);
  if (typeof d.count === "number") bits.push(`${d.count} ${d.count === 1 ? "row" : "rows"}`);
  if (typeof d.questions === "number") bits.push(`${d.questions} ${d.questions === 1 ? "question" : "questions"}`);
  if (typeof d.people === "number") bits.push(`${d.people} ${d.people === 1 ? "person" : "people"}`);
  if (typeof d.ends_on === "string") bits.push(`until ${d.ends_on}`);
  if (typeof d.score === "number") bits.push(`score ${d.score}`);
  const ref = l.entity_id && !["export", "members_imported"].includes(l.action) ? ` (#${l.entity_id.length > 12 ? l.entity_id.slice(0, 8) : l.entity_id})` : "";
  return `${base}${ref}${bits.length ? ` · ${bits.join(", ")}` : ""}`;
}
