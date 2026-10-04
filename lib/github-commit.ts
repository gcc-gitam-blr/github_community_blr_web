import { BRANCH, REPO } from "./photo-upload";

/* Committing to the club's repository as the signed-in editor: the same GitHub login the content editor (/keystatic)
   uses, read from its cookie. Only people who can push to the repository can use it. */
const API = "https://api.github.com";
const gh = async <T,>(token: string, path: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(`${API}${path}`, { ...init, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
  return r.json() as Promise<T>;
};

export const editorToken = (req: Request) => req.headers.get("cookie")?.match(/(?:^|;\s*)keystatic-gh-access-token=([^;]+)/)?.[1] ?? null;

/** Whether this login may write to the repository (the content editor's own rule). */
export async function canPush(token: string) {
  try { return !!(await gh<{ permissions?: { push?: boolean } }>(token, `/repos/${REPO}`)).permissions?.push; } catch { return false; }
}

export const createBlob = (token: string, base64: string) =>
  gh<{ sha: string }>(token, `/repos/${REPO}/git/blobs`, { method: "POST", body: JSON.stringify({ content: base64, encoding: "base64" }) }).then((b) => b.sha);

/** Reads a text file from the branch, with the commit it came from. */
export async function readFile(token: string, path: string) {
  const ref = await gh<{ object: { sha: string } }>(token, `/repos/${REPO}/git/ref/heads/${BRANCH}`);
  const file = await gh<{ content: string }>(token, `/repos/${REPO}/contents/${path}?ref=${ref.object.sha}`);
  return { head: ref.object.sha, text: Buffer.from(file.content, "base64").toString("utf8") };
}

/** One commit on top of `head` with the given files (blobs by sha, or text), then moves the branch to it. */
export async function commitFiles(token: string, head: string, message: string, files: { path: string; sha?: string; text?: string }[]) {
  const base = await gh<{ tree: { sha: string } }>(token, `/repos/${REPO}/git/commits/${head}`);
  const tree = await gh<{ sha: string }>(token, `/repos/${REPO}/git/trees`, { method: "POST", body: JSON.stringify({
    base_tree: base.tree.sha, tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", ...(f.sha ? { sha: f.sha } : { content: f.text }) })),
  }) });
  const commit = await gh<{ sha: string }>(token, `/repos/${REPO}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [head] }) });
  await gh(token, `/repos/${REPO}/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  return commit.sha;
}
