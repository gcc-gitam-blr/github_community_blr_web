import { supabase } from "@/lib/epoch/supabase-store";
import { rpcRes } from "@/lib/admin/client";
import type { IdeaStatus } from "@/lib/projects";

/* What the project hub reads and changes. Every call runs as the signed-in person, so the database's own rules
   (supabase/schema.sql) decide what is allowed; the page only hides what won't work. */
export interface Interests { domains: string[]; skills: string[]; wants: string | null; hours: string | null; discoverable: boolean }
export interface Idea { id: number; title: string; summary: string; domains: string[]; skills_wanted: string[]; team_size: number | null; repo_url: string | null; status: IdeaStatus; origin: "member" | "club"; owner_id: string | null; publish_state: "private" | "requested" | "published"; publish_note: string | null; created_at: string }
export interface TeamMember { project_id: number; user_id: string; role: "owner" | "member"; shows_publicly: boolean }
export interface JoinRequest { id: number; project_id: number; user_id: string; message: string | null; status: "pending" | "accepted" | "declined" | "withdrawn"; created_at: string }
export interface Summary { allowed: boolean; responses?: number; members?: number | null; domains?: { domain: string; count: number | null }[]; skills?: { skill: string; count: number }[]; hours?: Record<string, number | null> }
export interface Teammate { handle: string; name: string; domains: string[]; skills: string[]; wants: string | null; hours: string | null }
export interface IdeaFields { title: string; summary: string; domains: string[]; skills: string[]; teamSize: number | null; repo: string }

export async function whoAmI(): Promise<{ id: string; handle: string; name: string } | null> {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return null;
  const m = user.user_metadata as { user_name?: string; full_name?: string; name?: string };
  return { id: user.id, handle: m.user_name ?? "", name: m.full_name || m.name || m.user_name || "You" };
}
/** Is the signed-in person an active member (or on the core team)? The database answers; nobody else gets into the hub. */
export async function canTakePart(): Promise<boolean> { const { data } = await supabase().rpc("can_take_part"); return data === true; }

export async function myInterests(uid: string): Promise<Interests | null> {
  const { data } = await supabase().from("member_interests").select("domains, skills, wants, hours, discoverable").eq("user_id", uid).maybeSingle();
  return (data as Interests | null) ?? null;
}
export const saveInterests = (i: Interests) => rpcRes("save_interests", { p_domains: i.domains, p_skills: i.skills, p_wants: i.wants ?? "", p_hours: i.hours, p_discoverable: i.discoverable });
export const deleteInterests = () => rpcRes("delete_interests", {});
export async function summary(): Promise<Summary> { const { data } = await supabase().rpc("survey_summary"); return (data as Summary | null) ?? { allowed: false }; }
export async function findTeammates(domain: string | null, skill: string | null): Promise<Teammate[]> {
  const { data } = await supabase().rpc("find_teammates", { p_domain: domain, p_skill: skill });
  return (data ?? []) as Teammate[];
}

export async function ideas(): Promise<{ ideas: Idea[]; team: TeamMember[]; requests: JoinRequest[]; names: Record<string, { handle: string; name: string }> }> {
  const [i, t, r] = await Promise.all([
    supabase().from("project_ideas").select("*").order("created_at", { ascending: false }).limit(300),
    supabase().from("project_members").select("*"),
    supabase().from("project_requests").select("*").order("created_at", { ascending: false }),
  ]);
  const list = (i.data ?? []) as Idea[], team = (t.data ?? []) as TeamMember[], requests = (r.data ?? []) as JoinRequest[];
  const ids = [...new Set([...team.map((x) => x.user_id), ...requests.map((x) => x.user_id), ...list.map((x) => x.owner_id).filter(Boolean) as string[]])];
  const names = ids.length ? Object.fromEntries(((await supabase().from("profiles").select("id, handle, name").in("id", ids)).data ?? []).map((x) => [x.id as string, { handle: x.handle as string, name: x.name as string }])) : {};
  return { ideas: list, team, requests, names };
}
const fields = (f: IdeaFields) => ({ p_title: f.title, p_summary: f.summary, p_domains: f.domains, p_skills: f.skills, p_team_size: f.teamSize, p_repo_url: f.repo });
export const postIdea = (f: IdeaFields, club = false) => rpcRes<{ id: number }>("post_idea", { ...fields(f), p_club: club });
export const updateIdea = (id: number, f: IdeaFields) => rpcRes<{ back_to_review: boolean }>("update_idea", { p_id: id, ...fields(f) });
export const setIdeaStatus = (id: number, status: IdeaStatus) => rpcRes("set_idea_status", { p_id: id, p_status: status });
export const requestToJoin = (id: number, message: string) => rpcRes("request_to_join", { p_id: id, p_message: message });
export const withdrawRequest = (id: number) => rpcRes("withdraw_request", { p_request: id });
export const decideRequest = (id: number, accept: boolean) => rpcRes("decide_request", { p_request: id, p_accept: accept });
export const leaveProject = (id: number) => rpcRes("leave_project", { p_id: id });
export const removeProjectMember = (id: number, user: string) => rpcRes("remove_project_member", { p_id: id, p_user: user });
export const setProjectOwner = (id: number, handle: string) => rpcRes("set_project_owner", { p_id: id, p_handle: handle });
export const setPublicCredit = (id: number, show: boolean) => rpcRes("set_public_credit", { p_id: id, p_show: show });
export const requestPublishing = (id: number) => rpcRes("request_publishing", { p_id: id });
export const decidePublishing = (id: number, approve: boolean, note: string) => rpcRes("decide_publishing", { p_id: id, p_approve: approve, p_note: note });
export const unpublishProject = (id: number) => rpcRes("unpublish_project", { p_id: id });

/** Core team and admins: everyone's answers (the database refuses anyone else), with names. */
export async function allInterests(): Promise<(Interests & { user_id: string; handle: string; name: string })[]> {
  const { data } = await supabase().from("member_interests").select("user_id, domains, skills, wants, hours, discoverable").order("updated_at", { ascending: false });
  const rows = (data ?? []) as (Interests & { user_id: string })[];
  if (!rows.length) return [];
  const { data: ps } = await supabase().from("profiles").select("id, handle, name").in("id", rows.map((r) => r.user_id));
  const who = Object.fromEntries((ps ?? []).map((p) => [p.id as string, p as { handle: string; name: string }]));
  return rows.map((r) => ({ ...r, handle: who[r.user_id]?.handle ?? "", name: who[r.user_id]?.name ?? "A member" }));
}
