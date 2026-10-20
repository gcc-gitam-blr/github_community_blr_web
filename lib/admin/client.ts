import { supabase } from "@/lib/epoch/supabase-store";
import type { Attendee } from "@/lib/attendance";
import type { ErrorRow } from "@/lib/client-errors";
import type { AccessRole } from "@/lib/admin/appointments";
import type { AssetProblem } from "@/lib/assets";
import type { Member, MemberRow } from "@/lib/admin/members";
import type { Answer, Question, RoundForm } from "@/lib/apply";

/* What the /admin dashboard reads and changes. Every call runs as the signed-in organiser, so the
   database's own rules (supabase/schema.sql) decide what's allowed — the UI only hides what won't work. */
export interface AttendanceRow { id: string; event: string; name: string; email: string; handle: string | null; emailed_at: string | null; created_at: string }
/** `role` is the live role. Admins also get the appointment behind it: its title, end date and id (null for everyone else). */
export interface Person { id: string; handle: string; name: string; role: "attendee" | AccessRole; title: string | null; ends_on: string | null; appointment_id: number | null; created_at: string }
export interface Pending { handle: string; role: AccessRole; title: string | null; ends_on: string | null }
type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function signedInUser() {
  const { data } = await supabase().auth.getUser();
  return data.user ? { id: data.user.id, handle: (data.user.user_metadata?.user_name as string) ?? "", name: (data.user.user_metadata?.full_name as string) ?? "" } : null;
}

/** First visit to /admin: make the profile (role 'attendee') so an admin can give this person access. */
export async function ensureProfile(name: string): Promise<Res> {
  const { error } = await supabase().rpc("register_profile", { p_name: name.trim().slice(0, 80) || "Organiser" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function attendance(event: string): Promise<AttendanceRow[]> {
  const { data } = await supabase().from("attendance").select("*").eq("event", event).order("name");
  return (data ?? []) as AttendanceRow[];
}

/** Adds people to an event; anyone already there is left as they are. */
export async function addAttendees(event: string, people: Attendee[]): Promise<Res<{ added: number }>> {
  if (!people.length) return { ok: true, added: 0 };
  const rows = people.map((p) => ({ event, name: p.name, email: p.email.toLowerCase(), handle: p.handle ?? null }));
  const { data, error } = await supabase().from("attendance").upsert(rows, { onConflict: "event,email", ignoreDuplicates: true }).select("id");
  return error ? { ok: false, error: error.message } : { ok: true, added: data?.length ?? 0 };
}

/** Correct the name printed on someone's certificate (and used in the email). Organisers only, by the table's rules. */
export async function renameAttendee(id: string, name: string): Promise<Res> {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 80) return { ok: false, error: "A name is 2 to 80 characters." };
  const { error } = await supabase().from("attendance").update({ name: n }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function removeAttendee(id: string): Promise<Res> {
  const { error } = await supabase().from("attendance").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function people(): Promise<Person[]> {
  const { data } = await supabase().rpc("list_people");
  return (data ?? []) as Person[];
}

/** Appoints someone (or changes their role, or extends the term) until `endsOn`. Works before their first sign-in too. */
export async function grantAppointment(handle: string, role: AccessRole, title: string, endsOn: string): Promise<Res<{ pending?: boolean }>> {
  const { data, error } = await supabase().rpc("grant_appointment", { p_handle: handle, p_role: role, p_title: title.trim() || null, p_ends_on: endsOn || null });
  if (error) return { ok: false, error: error.message };
  return data?.ok ? { ok: true, pending: !!data.pending } : { ok: false, error: data?.error ?? "Couldn't change who has access." };
}

export async function endAppointment(id: number, reason: string): Promise<Res> {
  const { data, error } = await supabase().rpc("end_appointment", { p_id: id, p_reason: reason.trim() });
  if (error) return { ok: false, error: error.message };
  return data?.ok ? { ok: true } : { ok: false, error: data?.error ?? "Couldn't end that access." };
}

/** Takes back access that was promised to a username that hasn't signed in yet. */
export async function cancelPending(handle: string): Promise<Res> {
  const { data, error } = await supabase().rpc("set_role", { p_handle: handle, p_role: "attendee" });
  if (error) return { ok: false, error: error.message };
  return data?.ok ? { ok: true } : { ok: false, error: data?.error ?? "Couldn't cancel that." };
}

/** Access granted to usernames that haven't signed in yet (admins only). */
export async function pendingRoles(): Promise<Pending[]> {
  const { data } = await supabase().from("pending_roles").select("handle, role, title, ends_on").order("created_at", { ascending: false });
  return (data ?? []) as Pending[];
}

/** `left`: not tried yet (the batch stops before the server's time limit); `problem`: why some failed, in words. */
export async function sendCertificates(event: string, ids?: string[], msg?: { note: string; subject: string }): Promise<Res<{ sent: number; failed: number; total: number; left?: number; problem?: string }>> {
  const { data: { session } } = await supabase().auth.getSession();
  if (!session) return { ok: false, error: "Sign in again." };
  try {
    const r = await fetch("/api/certificates", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ event, ids, ...msg }) });
    return await r.json();
  } catch { return { ok: false, error: "Network error. Please try again." }; }
}

/** Errors from visitors' browsers in the last 30 days (older ones are deleted). Only admins can read them. */
export async function clientErrors(): Promise<ErrorRow[] | null> {
  const { data, error } = await supabase().from("client_errors").select("*").order("created_at", { ascending: false }).limit(1000);
  return error ? null : (data ?? []) as ErrorRow[];
}

/** Calls one of the database's functions that answer { ok, error?, … }; the database decides whether the caller may. */
/** A function the site calls that the database doesn't have yet: the schema hasn't been re-run since the site was updated. */
export const notUpdated = (msg: string) => /could not find the function|does not exist|schema cache/i.test(msg)
  ? "The database needs the latest update first: in Supabase, open SQL Editor and run supabase/schema.sql once (it only adds what's missing). Then try again." : msg;
export async function rpcRes<T extends object = object>(fn: string, args: Record<string, unknown>, failed = "That didn't work. Please try again."): Promise<Res<T>> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) return { ok: false, error: notUpdated(error.message) };
  return data?.ok ? { ok: true, ...(data as T) } : { ok: false, error: data?.error ?? failed };
}

// ---- Members ----
export async function members(): Promise<Member[]> {
  const { data } = await supabase().from("members").select("*").order("name").limit(2000);
  return (data ?? []) as Member[];
}
const memberArgs = (m: MemberRow) => ({ p_name: m.name, p_email: m.email, p_handle: m.handle, p_team: m.team, p_joined_on: m.joined_on || null });
export const createMember = (m: MemberRow) => rpcRes("create_member", memberArgs(m));
export const updateMember = (id: string, m: MemberRow) => rpcRes("update_member", { p_id: id, ...memberArgs(m) });
export const setMemberStatus = (id: string, status: Member["status"]) => rpcRes("set_member_status", { p_id: id, p_status: status });
export interface ImportReport { total: number; valid: number; dry_run: boolean; added?: number; updated?: number; unchanged?: number; errors: { row: number; error: string }[]; notes?: { row: number; note: string }[] }
/** Checks (dryRun) or writes a list of people. With any problem nothing is written, and the report says which rows.
    People already on the list are kept; only what their record is missing is filled in. */
export async function importMembers(rows: MemberRow[], dryRun: boolean): Promise<(ImportReport & { ok: boolean }) | { ok: false; error: string }> {
  const { data, error } = await supabase().rpc("import_members", { p_rows: rows, p_dry_run: dryRun });
  if (error) return { ok: false, error: error.message };
  return data?.total === undefined ? { ok: false, error: data?.error ?? "Couldn't check that file." } : data;
}
/** Both exports go through a database function that records the download in the audit log. */
export async function exportMembers(): Promise<Member[] | null> { const { data, error } = await supabase().rpc("export_members"); return error ? null : (data ?? []) as Member[]; }
export async function exportSignups(): Promise<{ name: string | null; handle: string | null; email: string; first_event: string | null; created_at: string }[] | null> {
  const { data, error } = await supabase().rpc("export_signups"); return error ? null : data ?? [];
}

// ---- Recruitment ----
/** `intro`, `questions` and `teams` are the round's own form (missing until the schema is re-run: use DEFAULT_QUESTIONS). */
export interface Campaign { id: number; name: string; year: string; status: "draft" | "open" | "closed" | "archived"; opens_on: string; closes_on: string; intro?: string | null; questions?: Question[]; teams?: string[] }
export interface Application { id: number; campaign_id: number; name: string; email: string; handle: string; team_pref: string | null; answers: Record<string, Answer>; status: ApplicationStatus; created_at: string }
export type ApplicationStatus = "submitted" | "screening" | "interview" | "selected" | "waitlisted" | "rejected" | "withdrawn" | "onboarded";
export interface Review { id: number; application_id: number; reviewer_id: string; score: number; notes: string | null }
export interface Decision { application_id: number; decision: "selected" | "waitlisted" | "rejected"; reason: string | null }
export async function campaigns(): Promise<Campaign[]> {
  const { data } = await supabase().from("recruitment_campaigns").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Campaign[];
}
/** Who reviews this round (admins see the list; a reviewer sees only themselves). */
export async function reviewers(campaign: number): Promise<{ user_id: string; handle: string }[]> {
  const { data } = await supabase().from("campaign_reviewers").select("user_id").eq("campaign_id", campaign);
  const ids = (data ?? []).map((r) => r.user_id as string);
  if (!ids.length) return [];
  const { data: ps } = await supabase().from("profiles").select("id, handle").in("id", ids);
  return (ps ?? []).map((p) => ({ user_id: p.id as string, handle: p.handle as string }));
}
/** The applications this person may read (RLS: admins all, reviewers their assigned campaigns), with reviews and decisions. */
export async function applications(campaign: number): Promise<{ apps: Application[]; reviews: Review[]; decisions: Decision[] }> {
  const { data } = await supabase().from("applications").select("*").eq("campaign_id", campaign).order("created_at");
  const apps = (data ?? []) as Application[];
  if (!apps.length) return { apps, reviews: [], decisions: [] };
  const ids = apps.map((a) => a.id);
  const [r, d] = await Promise.all([supabase().from("application_reviews").select("*").in("application_id", ids), supabase().from("selection_decisions").select("application_id, decision, reason").in("application_id", ids)]);
  return { apps, reviews: (r.data ?? []) as Review[], decisions: (d.data ?? []) as Decision[] };
}
export const createCampaign = (name: string, year: string, opensOn: string, closesOn: string) => rpcRes<{ id: number }>("create_campaign", { p_name: name, p_year: year, p_opens_on: opensOn, p_closes_on: closesOn });
export const setCampaignStatus = (id: number, status: Campaign["status"]) => rpcRes("set_campaign_status", { p_id: id, p_status: status });
export const setCampaignDates = (id: number, opensOn: string, closesOn: string) => rpcRes("set_campaign_dates", { p_id: id, p_opens_on: opensOn, p_closes_on: closesOn });
export const addReviewer = (campaign: number, handle: string) => rpcRes("add_reviewer", { p_campaign: campaign, p_handle: handle });
export const removeReviewer = (campaign: number, user: string) => rpcRes("remove_reviewer", { p_campaign: campaign, p_user: user });
export const reviewApplication = (app: number, score: number, notes: string) => rpcRes("review_application", { p_app: app, p_score: score, p_notes: notes });
export const moveApplication = (app: number, to: ApplicationStatus) => rpcRes("move_application", { p_app: app, p_to: to });
export const decideApplication = (app: number, decision: Decision["decision"], reason: string) => rpcRes("decide_application", { p_app: app, p_decision: decision, p_reason: reason });
export const onboardApplication = (app: number) => rpcRes("onboard_application", { p_app: app });
/** A round's form: its introduction, questions and teams. Admins only. */
export const setCampaignForm = (id: number, f: RoundForm) => rpcRes("set_campaign_form", { p_id: id, p_intro: f.intro ?? "", p_questions: f.questions, p_teams: f.teams });
/** A round's applications for a spreadsheet; the download is logged. Admins only (null if it failed). */
export async function exportApplications(campaign: number): Promise<Application[] | null> {
  const { data, error } = await supabase().rpc("export_applications", { p_campaign: campaign });
  return error ? null : (data ?? []) as Application[];
}
/** Who an applicants' email goes to: one stage of the round, or everyone who applied (except those who withdrew). */
export type ApplicantGroup = "interview" | "selected" | "waitlisted" | "rejected" | "all";
export async function emailApplicants(campaign: number, group: ApplicantGroup, subject: string, message: string): Promise<Res<{ sent: number; failed: number; total: number; problem?: string }>> {
  const { data: { session } } = await supabase().auth.getSession();
  if (!session) return { ok: false, error: "Sign in again." };
  try {
    const r = await fetch("/api/recruitment/email", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ campaign, group, subject, message }) });
    return await r.json();
  } catch { return { ok: false, error: "Network error. Nothing was sent." }; }
}

// ---- Event proposals ----
export type ProposalStatus = "draft" | "submitted" | "returned" | "approved" | "rejected" | "cancelled" | "completed";
export interface Proposal {
  id: number; title: string; kind: "workshop" | "talk" | "hackathon" | "meetup" | "fest" | "other"; proposed_by: string | null; proposed_date: string; venue: string; objective: string;
  expected_attendance: number | null; budget_inr: number | null; status: ProposalStatus; event_slug: string | null; decided_by: string | null; decision_note: string | null;
  outcome_note: string | null; attendance_event: string | null; attendance_note: string | null; created_at: string; updated_at: string;
  details?: ProposalDetails; // for the official document; missing until the schema is re-run

}
export interface ChecklistItem { id: number; proposal_id: number; label: string; required: boolean; state: "open" | "done" | "na"; note: string | null; sort: number }
export interface ProposalFields { title: string; kind: Proposal["kind"]; date: string; venue: string; objective: string; expected: number | null; budget: number | null }
export async function proposals(): Promise<{ list: Proposal[]; items: ChecklistItem[]; names: Record<string, string> }> {
  const { data } = await supabase().from("event_proposals").select("*").order("proposed_date", { ascending: true }).limit(500);
  const list = (data ?? []) as Proposal[];
  if (!list.length) return { list, items: [], names: {} };
  const [i, p] = await Promise.all([
    supabase().from("proposal_checklist_items").select("*").in("proposal_id", list.map((x) => x.id)).order("sort"),
    supabase().from("profiles").select("id, name").in("id", [...new Set(list.flatMap((x) => [x.proposed_by, x.decided_by]).filter(Boolean) as string[])]),
  ]);
  return { list, items: (i.data ?? []) as ChecklistItem[], names: Object.fromEntries((p.data ?? []).map((x) => [x.id as string, x.name as string])) };
}
const pf = (f: ProposalFields) => ({ p_title: f.title, p_kind: f.kind, p_date: f.date, p_venue: f.venue, p_objective: f.objective, p_expected: f.expected, p_budget: f.budget });
export const createProposal = (f: ProposalFields) => rpcRes<{ id: number }>("create_proposal", pf(f));
export const updateProposal = (id: number, f: ProposalFields) => rpcRes("update_proposal", { p_id: id, ...pf(f) });
export const submitProposal = (id: number) => rpcRes("submit_proposal", { p_id: id });
export const decideProposal = (id: number, decision: "approved" | "returned" | "rejected", note: string) => rpcRes("decide_proposal", { p_id: id, p_decision: decision, p_note: note });
export const cancelProposal = (id: number, reason: string) => rpcRes("cancel_proposal", { p_id: id, p_reason: reason });
export const completeProposal = (id: number, outcome: string, attendanceEvent: string | null, attendanceNote: string) => rpcRes("complete_proposal", { p_id: id, p_outcome: outcome, p_attendance_event: attendanceEvent, p_attendance_note: attendanceNote });
export const setChecklistItem = (item: number, state: ChecklistItem["state"], note: string) => rpcRes("set_checklist_item", { p_item: item, p_state: state, p_note: note });
export const linkProposalEvent = (id: number, slug: string) => rpcRes("link_proposal_event", { p_id: id, p_slug: slug });

// ---- Tasks, meetings and decisions ----
export type TaskStatus = "todo" | "doing" | "blocked" | "done" | "dropped";
export interface Task { id: number; title: string; details: string | null; owner_id: string; creator_id: string; due_on: string; status: TaskStatus; proposal_id: number | null; meeting_id: number | null; completed_at: string | null }
export interface Meeting { id: number; title: string; held_on: string; kind: "core" | "general" | "planning" | "review" | "other"; agenda: string | null; minutes: string | null; created_by: string | null; minutes_finalised_at: string | null; details?: MeetingDetails }
export interface MeetingNote { id: number; meeting_id: number; author_id: string | null; note: string; created_at: string }
export interface DecisionRow { id: number; meeting_id: number | null; title: string; decision: string; rationale: string | null; decided_on: string; status: "active" | "superseded"; supersedes_id: number | null }
export async function tasks(): Promise<Task[]> {
  const { data } = await supabase().from("tasks").select("*").order("due_on").limit(2000);
  return (data ?? []) as Task[];
}
/** Everyone who may own a task (a core or admin appointment today), for the owner pickers. Names come from list_people. */
export async function owners(): Promise<{ id: string; handle: string; name: string; role: string }[]> {
  const { data } = await supabase().rpc("list_people");
  return ((data ?? []) as { id: string; handle: string; name: string; role: string }[]).filter((p) => p.role === "core" || p.role === "admin");
}
export const createTask = (title: string, details: string, owner: string, dueOn: string, meeting: number | null = null) => rpcRes<{ id: number }>("create_task", { p_title: title, p_details: details, p_owner_handle: owner, p_due_on: dueOn || null, p_meeting: meeting });
export const setTaskStatus = (id: number, status: TaskStatus) => rpcRes("set_task_status", { p_id: id, p_status: status });
export const reassignTask = (id: number, owner: string | null, dueOn: string | null) => rpcRes("reassign_task", { p_id: id, p_owner_handle: owner, p_due_on: dueOn });
export async function meetings(): Promise<{ list: Meeting[]; notes: MeetingNote[]; attendees: { meeting_id: number; user_id: string }[]; decisions: DecisionRow[]; names: Record<string, string> }> {
  const [m, n, a, d] = await Promise.all([
    supabase().from("meetings").select("*").order("held_on", { ascending: false }).limit(300),
    supabase().from("meeting_notes").select("*").order("created_at"),
    supabase().from("meeting_attendees").select("*"),
    supabase().from("decisions").select("*").order("decided_on", { ascending: false }).order("id", { ascending: false }).limit(1000),
  ]);
  const attendees = (a.data ?? []) as { meeting_id: number; user_id: string }[];
  const ids = [...new Set([...attendees.map((x) => x.user_id), ...((n.data ?? []) as MeetingNote[]).map((x) => x.author_id).filter(Boolean) as string[]])];
  const names = ids.length ? Object.fromEntries(((await supabase().from("profiles").select("id, name").in("id", ids)).data ?? []).map((x) => [x.id as string, x.name as string])) : {};
  return { list: (m.data ?? []) as Meeting[], notes: (n.data ?? []) as MeetingNote[], attendees, decisions: (d.data ?? []) as DecisionRow[], names };
}
export const createMeeting = (title: string, heldOn: string, kind: Meeting["kind"], agenda: string) => rpcRes<{ id: number }>("create_meeting", { p_title: title, p_held_on: heldOn || null, p_kind: kind, p_agenda: agenda });
export const updateMeeting = (id: number, title: string, agenda: string, minutes: string) => rpcRes("update_meeting", { p_id: id, p_title: title, p_agenda: agenda, p_minutes: minutes });
export const setAttendees = (id: number, handles: string[]) => rpcRes<{ count: number }>("set_attendees", { p_id: id, p_handles: handles });
export const finaliseMinutes = (id: number) => rpcRes("finalise_minutes", { p_id: id });
export const addMinutesNote = (id: number, note: string) => rpcRes("add_minutes_note", { p_id: id, p_note: note });
export const recordDecision = (meeting: number | null, title: string, decision: string, rationale: string, on: string) => rpcRes<{ id: number }>("record_decision", { p_meeting: meeting, p_title: title, p_decision: decision, p_rationale: rationale, p_decided_on: on });
export const supersedeDecision = (old: number, title: string, decision: string, rationale: string) => rpcRes<{ id: number }>("supersede_decision", { p_old: old, p_title: title, p_decision: decision, p_rationale: rationale });

// ---- Official documents: a proposal and minutes of a meeting, in the university's formats ----
/** `date_tbd`: the date isn't fixed yet, so the document says "Yet to be decided". Outcomes and requirements: one per line. */
export interface ProposalDetails { days?: number; date_tbd?: boolean; time?: string; mode?: "offline" | "online" | "hybrid"; audience?: string; description?: string; outcomes?: string; requirements?: string }
export const setProposalDetails = (id: number, d: ProposalDetails) => rpcRes("set_proposal_details", { p_id: id, p_details: d });
/** Times as HH:MM; chair and recorder are profile ids. */
export interface MeetingDetails { starts?: string; ends?: string; mode?: "offline" | "online" | "hybrid"; venue?: string; chair?: string; recorder?: string }
export const setMeetingDetails = (id: number, d: MeetingDetails) => rpcRes("set_meeting_details", { p_id: id, p_details: d });
export interface RosterPerson { id: string; name: string; handle: string; title: string | null }
export type Roster = { present: RosterPerson[]; absent: RosterPerson[] };
/** Who came and who didn't (organisers on the team that day), each with their title on the day. */
export async function meetingRoster(id: number): Promise<Roster | null> {
  const { data } = await supabase().rpc("meeting_roster", { p_id: id });
  return (data as Roster | null) ?? null;
}
/** Everything the proposal's document prints. */
export async function proposalDoc(id: number): Promise<{ p: Proposal; by: string | null } | null> {
  const { data } = await supabase().from("event_proposals").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const p = data as Proposal;
  const by = p.proposed_by ? ((await supabase().from("profiles").select("name").eq("id", p.proposed_by).maybeSingle()).data?.name as string | undefined) ?? null : null;
  return { p, by };
}
/** Everything the minutes' document prints: the meeting, who came, its decisions, its action items and later notes. */
export async function minutesDoc(id: number) {
  const sb = supabase();
  const [m, roster, d, t, n] = await Promise.all([
    sb.from("meetings").select("*").eq("id", id).maybeSingle(), meetingRoster(id),
    sb.from("decisions").select("*").eq("meeting_id", id).order("id"),
    sb.from("tasks").select("id, title, owner_id, due_on, status").eq("meeting_id", id).order("due_on"),
    sb.from("meeting_notes").select("*").eq("meeting_id", id).order("created_at"),
  ]);
  if (!m.data) return null;
  const tasks = (t.data ?? []) as { id: number; title: string; owner_id: string; due_on: string; status: TaskStatus }[];
  const ids = [...new Set(tasks.map((x) => x.owner_id))];
  const names = ids.length ? Object.fromEntries(((await sb.from("profiles").select("id, name").in("id", ids)).data ?? []).map((x) => [x.id as string, x.name as string])) : {};
  return { m: m.data as Meeting, roster: roster ?? { present: [], absent: [] }, decisions: (d.data ?? []) as DecisionRow[], tasks: tasks.map((x) => ({ ...x, owner: names[x.owner_id] ?? "" })), notes: (n.data ?? []) as MeetingNote[] };
}

// ---- Digital assets and the handover checklist ----
export interface Asset { id: number; name: string; kind: "domain" | "hosting" | "repository" | "database" | "email" | "social" | "design" | "event_platform" | "other"; location_url: string | null; owner_id: string | null; backup_owner_id: string | null; notes: string | null; review_due_on: string | null }
export interface Handover { id: number; term_label: string; status: "open" | "complete"; completed_at: string | null; created_at: string }
export interface HandoverItem { id: number; checklist_id: number; category: string; label: string; state: "open" | "done" | "waived"; note: string | null; sort: number }
export interface AssetFields { name: string; kind: Asset["kind"]; url: string; owner: string; backup: string; notes: string; reviewDue: string }
export async function assets(): Promise<{ list: Asset[]; problems: AssetProblem[]; people: Record<string, { handle: string; name: string }> }> {
  const [a, w, p] = await Promise.all([supabase().from("digital_assets").select("*").order("name"), supabase().rpc("asset_warnings"), supabase().rpc("list_people")]);
  const people = Object.fromEntries(((p.data ?? []) as { id: string; handle: string; name: string }[]).map((x) => [x.id, { handle: x.handle, name: x.name }]));
  return { list: (a.data ?? []) as Asset[], problems: (w.data ?? []) as AssetProblem[], people };
}
export const saveAsset = (id: number | null, f: AssetFields) => rpcRes<{ id: number }>("save_asset", { p_id: id, p_name: f.name, p_kind: f.kind, p_url: f.url, p_owner: f.owner, p_backup: f.backup, p_notes: f.notes, p_review_due: f.reviewDue || null });
export const setAssetNotes = (id: number, notes: string) => rpcRes("set_asset_notes", { p_id: id, p_notes: notes });
export async function handovers(): Promise<{ lists: Handover[]; items: HandoverItem[] }> {
  const { data } = await supabase().from("handover_checklists").select("*").order("created_at", { ascending: false }).limit(20);
  const lists = (data ?? []) as Handover[];
  if (!lists.length) return { lists, items: [] };
  const { data: it } = await supabase().from("handover_items").select("*").eq("checklist_id", lists[0].id).order("sort");
  return { lists, items: (it ?? []) as HandoverItem[] };
}
export const startHandover = (term: string) => rpcRes<{ id: number }>("start_handover", { p_term: term });
export const setHandoverItem = (item: number, state: HandoverItem["state"], note: string) => rpcRes("set_handover_item", { p_item: item, p_state: state, p_note: note });
export const completeHandover = (id: number) => rpcRes("complete_handover", { p_id: id });

// ---- Policies ----
export interface PolicyRow { id: number; slug: string; title: string; owner_id: string | null }
export interface PolicyVersion { id: number; policy_id: number; version: number; body_md: string; author_id: string | null; approved_by: string | null; approved_on: string; effective_on: string; review_due_on: string }
export interface PolicyDraft { policy_id: number; body_md: string; author_id: string | null; updated_at: string }
export async function policies(): Promise<{ list: PolicyRow[]; versions: PolicyVersion[]; drafts: PolicyDraft[]; names: Record<string, string> }> {
  const [p, v, d] = await Promise.all([
    supabase().from("policies").select("*").order("title"),
    supabase().from("policy_versions").select("*").order("version", { ascending: false }),
    supabase().from("policy_drafts").select("*"), // admins only; empty for everyone else
  ]);
  const versions = (v.data ?? []) as PolicyVersion[], drafts = (d.data ?? []) as PolicyDraft[], list = (p.data ?? []) as PolicyRow[];
  const ids = [...new Set([...list.map((x) => x.owner_id), ...versions.flatMap((x) => [x.author_id, x.approved_by]), ...drafts.map((x) => x.author_id)].filter(Boolean) as string[])];
  const names = ids.length ? Object.fromEntries(((await supabase().from("profiles").select("id, name").in("id", ids)).data ?? []).map((x) => [x.id as string, x.name as string])) : {};
  return { list, versions, drafts, names };
}
export const createPolicy = (slug: string, title: string, owner: string) => rpcRes<{ id: number }>("create_policy", { p_slug: slug, p_title: title, p_owner: owner });
export const setPolicyOwner = (id: number, owner: string) => rpcRes("set_policy_owner", { p_id: id, p_owner: owner });
export const savePolicyDraft = (id: number, body: string) => rpcRes("save_policy_draft", { p_id: id, p_body: body });
export const discardPolicyDraft = (id: number) => rpcRes("discard_policy_draft", { p_id: id });
export const publishPolicyVersion = (id: number, effectiveOn: string, reviewDueOn: string) => rpcRes<{ version: number }>("publish_policy_version", { p_id: id, p_effective_on: effectiveOn || null, p_review_due_on: reviewDueOn || null });

// ---- The audit log (admins) ----
export interface AuditRow { id: number; at: string; actor: string | null; action: string; entity: string; entity_id: string | null; detail: Record<string, unknown> }
export async function auditLog(): Promise<{ rows: AuditRow[]; names: Record<string, string> }> {
  const { data } = await supabase().from("crm_audit").select("*").order("at", { ascending: false }).order("id", { ascending: false }).limit(500);
  const rows = (data ?? []) as AuditRow[];
  const ids = [...new Set(rows.map((r) => r.actor).filter(Boolean) as string[])];
  const names = ids.length ? Object.fromEntries(((await supabase().from("profiles").select("id, name").in("id", ids)).data ?? []).map((x) => [x.id as string, x.name as string])) : {};
  return { rows, names };
}

// ---- One member's history (the core team's view of a person) ----
export interface MemberHistory {
  events: { event: string; title: string }[];
  role: { role: string; title: string | null; ends_on: string | null } | null;
  projects: { id: number; title: string; status: string; owner: boolean }[];
  interests: { domains: string[]; skills: string[]; wants: string | null } | null;
}
/** Everything the club knows about one member, gathered from the other tabs (each read is limited by the database as usual). */
export async function memberHistory(m: Member): Promise<MemberHistory> {
  const sb = supabase();
  const ors = [`email.eq.${m.email.toLowerCase()}`, ...(m.handle ? [`handle.ilike.${m.handle}`] : [])].join(",");
  const [att, people] = await Promise.all([sb.from("attendance").select("event").or(ors), m.user_id ? sb.rpc("list_people") : Promise.resolve({ data: [] })]);
  const { CLUB } = await import("@/lib/config");
  const events = [...new Set(((att.data ?? []) as { event: string }[]).map((a) => a.event))].sort().map((e) => ({ event: e, title: CLUB.events.find((x) => x.date === e)?.title ?? e }));
  const me = ((people.data ?? []) as { id: string; role: string; title: string | null; ends_on: string | null }[]).find((p) => p.id === m.user_id);
  let projects: MemberHistory["projects"] = [], interests: MemberHistory["interests"] = null;
  if (m.user_id) {
    const [pm, mi] = await Promise.all([sb.from("project_members").select("project_id, role").eq("user_id", m.user_id), sb.from("member_interests").select("domains, skills, wants").eq("user_id", m.user_id).maybeSingle()]);
    const rows = (pm.data ?? []) as { project_id: number; role: string }[];
    if (rows.length) {
      const { data } = await sb.from("project_ideas").select("id, title, status").in("id", rows.map((r) => r.project_id));
      projects = ((data ?? []) as { id: number; title: string; status: string }[]).map((p) => ({ ...p, owner: rows.find((r) => r.project_id === p.id)?.role === "owner" }));
    }
    interests = (mi.data as MemberHistory["interests"]) ?? null;
  }
  return { events, role: me && me.role !== "attendee" ? { role: me.role, title: me.title, ends_on: me.ends_on } : null, projects, interests };
}
