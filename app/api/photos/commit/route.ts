import { canPush, commitFiles, editorToken, readFile } from "@/lib/github-commit";
import { MAX_PER_UPLOAD, addToManifest, folderOk } from "@/lib/photo-upload";
import type { Photo } from "@/components/site/PhotoGrid";

/* POST /api/photos/commit — adds the uploaded photos to a gallery folder and lib/gallery.json in one commit.
   The site redeploys on its own, and the photos appear in the gallery, recaps and Memories in a minute or two. */
const json = (b: object, status = 200) => Response.json(b, { status });
type In = { folder?: string; title?: string; photos?: { shas: Record<"sm" | "md" | "lg", string>; w: number; h: number; caption?: string }[] };
const sha = (s: unknown) => typeof s === "string" && /^[0-9a-f]{40}$/.test(s);

export async function POST(req: Request) {
  const token = editorToken(req);
  if (!token) return json({ error: "Log in to the content editor first (/keystatic), then come back." }, 401);
  if (!(await canPush(token))) return json({ error: "Your GitHub login can't change the club's repository." }, 403);
  let b: In; try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const folder = b.folder ?? "", title = (b.title ?? "").trim().slice(0, 120) || folder, photos = b.photos ?? [];
  if (!folderOk(folder)) return json({ error: "Pick a folder name: lowercase words joined by dashes." }, 422);
  if (!photos.length || photos.length > MAX_PER_UPLOAD) return json({ error: `Add 1 to ${MAX_PER_UPLOAD} photos at a time.` }, 422);
  if (photos.some((p) => !p.shas || !sha(p.shas.sm) || !sha(p.shas.md) || !sha(p.shas.lg) || !(p.w > 0 && p.w <= 4000) || !(p.h > 0 && p.h <= 4000))) return json({ error: "Something went wrong with one of the photos. Try again." }, 422);

  for (let attempt = 0; attempt < 2; attempt++) { // someone else saving in the editor at the same moment: read again and retry once
    try {
      const { head, text } = await readFile(token, "lib/gallery.json");
      const { manifest, added } = addToManifest(JSON.parse(text) as Photo[], folder, title, photos);
      const files = added.flatMap((p, i) => (["sm", "md", "lg"] as const).map((s) => ({ path: `public/gallery/${folder}/${p.index}-${s}.webp`, sha: photos[i].shas[s] })));
      await commitFiles(token, head, `Add ${added.length} photo${added.length === 1 ? "" : "s"} to ${folder}`, [...files, { path: "lib/gallery.json", text: JSON.stringify(manifest, null, 2) + "\n" }]);
      return json({ ok: true, added: added.length, folder });
    } catch (e) {
      if (attempt === 1 || (e as { status?: number }).status !== 422) return json({ error: "GitHub didn't accept the commit. Try again in a minute." }, 502);
    }
  }
  return json({ error: "Try again." }, 502);
}
