import { canPush, createBlob, editorToken } from "@/lib/github-commit";
import { MAX_IMAGE_BYTES, isWebp } from "@/lib/photo-upload";

/* POST /api/photos/blob — one resized photo (three WebP sizes, made in the browser) stored in the repository as blobs.
   Nothing is visible until /api/photos/commit adds them to the gallery. Needs the content editor's GitHub login. */
const json = (b: object, status = 200) => Response.json(b, { status });
const decode = (b64: unknown) => (typeof b64 === "string" && b64.length < MAX_IMAGE_BYTES * 1.4 ? Buffer.from(b64, "base64") : null);

export async function POST(req: Request) {
  const token = editorToken(req);
  if (!token) return json({ error: "Log in to the content editor first (/keystatic), then come back." }, 401);
  if (!(await canPush(token))) return json({ error: "Your GitHub login can't change the club's repository. Ask a lead to add you as a collaborator, or open /keystatic once to refresh your login." }, 403);
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const imgs = (["sm", "md", "lg"] as const).map((s) => [s, decode(body[s])] as const);
  if (imgs.some(([, b]) => !b || !isWebp(new Uint8Array(b)))) return json({ error: "Each photo must arrive as three WebP sizes." }, 422);
  const shas = Object.fromEntries(await Promise.all(imgs.map(async ([s, b]) => [s, await createBlob(token, b!.toString("base64"))])));
  return json({ shas });
}

/** GET: can this browser upload? (Logged in to the content editor with a login that can push.) */
export async function GET(req: Request) {
  const token = editorToken(req);
  if (!token) return json({ ok: false, reason: "login" });
  return json((await canPush(token)) ? { ok: true } : { ok: false, reason: "access" });
}
