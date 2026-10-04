import { supabase } from "@/lib/epoch/supabase-store";
import type { Attendee } from "@/lib/attendance";
import type { ErrorRow } from "@/lib/client-errors";

/* What the /admin dashboard reads and changes. Every call runs as the signed-in organiser, so the
   database's own rules (supabase/schema.sql) decide what's allowed — the UI only hides what won't work. */
export interface AttendanceRow { id: string; event: string; name: string; email: string; handle: string | null; emailed_at: string | null; created_at: string }
export interface Person { id: string; handle: string; name: string; role: "attendee" | "volunteer" | "admin"; created_at: string }
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
  const { data } = await supabase().from("profiles").select("id, handle, name, role, created_at").order("created_at", { ascending: false }).limit(1000);
  return (data ?? []) as Person[];
}

export async function setRole(handle: string, role: Person["role"]): Promise<Res> {
  const { data, error } = await supabase().rpc("set_role", { p_handle: handle, p_role: role });
  if (error) return { ok: false, error: error.message };
  return data?.ok ? { ok: true } : { ok: false, error: data?.error ?? "Couldn't change the role." };
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
