import { supabase } from "@/lib/epoch/supabase-store";
import type { Attendee } from "@/lib/attendance";
import type { ErrorRow } from "@/lib/client-errors";
import type { AccessRole } from "@/lib/admin/appointments";

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
