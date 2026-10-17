import { supabase } from "@/lib/epoch/supabase-store";
import type { Attendee } from "@/lib/attendance";
import type { ErrorRow } from "@/lib/client-errors";
import type { AccessRole } from "@/lib/admin/appointments";
import type { Member, MemberRow } from "@/lib/admin/members";

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

export async function sendCertificates(event: string, ids?: string[]): Promise<Res<{ sent: number; failed: number; total: number }>> {
  const { data: { session } } = await supabase().auth.getSession();
  if (!session) return { ok: false, error: "Sign in again." };
  try {
    const r = await fetch("/api/certificates", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ event, ids }) });
    return await r.json();
  } catch { return { ok: false, error: "Network error — please try again." }; }
}

/** Errors from visitors' browsers in the last 30 days (older ones are deleted). Only admins can read them. */
export async function clientErrors(): Promise<ErrorRow[] | null> {
  const { data, error } = await supabase().from("client_errors").select("*").order("created_at", { ascending: false }).limit(1000);
  return error ? null : (data ?? []) as ErrorRow[];
}

/** Calls one of the database's functions that answer { ok, error?, … }; the database decides whether the caller may. */
async function rpcRes<T extends object = object>(fn: string, args: Record<string, unknown>, failed = "That didn't work. Please try again."): Promise<Res<T>> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) return { ok: false, error: error.message };
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
export interface ImportReport { total: number; valid: number; dry_run: boolean; errors: { row: number; error: string }[] }
/** Checks (dryRun) or writes a list of people. With any problem nothing is written, and the report says which rows. */
export async function importMembers(rows: MemberRow[], dryRun: boolean): Promise<(ImportReport & { ok: boolean }) | { ok: false; error: string }> {
  const { data, error } = await supabase().rpc("import_members", { p_rows: rows, p_dry_run: dryRun });
  if (error) return { ok: false, error: error.message };
  return data?.total === undefined ? { ok: false, error: data?.error ?? "Couldn't check that file." } : data;
}
/** Both exports go through a database function that records the download in the audit log. */
export async function exportMembers(): Promise<Member[] | null> { const { data, error } = await supabase().rpc("export_members"); return error ? null : (data ?? []) as Member[]; }
export async function exportSignups(): Promise<{ handle: string; email: string; first_event: string; created_at: string }[] | null> {
  const { data, error } = await supabase().rpc("export_signups"); return error ? null : data ?? [];
}

// ---- Recruitment ----
export interface Campaign { id: number; name: string; year: string; status: "draft" | "open" | "closed" | "archived"; opens_on: string; closes_on: string }
export interface Application { id: number; campaign_id: number; name: string; email: string; handle: string; team_pref: string | null; answers: Record<string, string>; status: ApplicationStatus; created_at: string }
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
