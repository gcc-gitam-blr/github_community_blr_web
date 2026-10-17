import { loadBoard, type Member } from "./board";
import { serverDb } from "./supabase-server";

/* Server only. The board's members: the team and contributors lists, plus every active member who opted in from My club
   (board_members in supabase/schema.sql). Without the database it is just the lists. */
export async function optedInMembers(): Promise<Member[]> {
  const db = serverDb();
  if (!db) return [];
  try {
    const { data, error } = await db.rpc("board_members");
    return error || !Array.isArray(data) ? [] : (data as { name: string; handle: string }[]).map((m) => ({ name: m.name, handle: m.handle, githubAvatar: true }));
  } catch { return []; }
}

export const loadClubBoard = async () => loadBoard(await optedInMembers());
