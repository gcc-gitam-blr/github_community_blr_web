/* The parts of scripts/photos.mjs that don't touch files, so tests can check them. */

/** A folder name as the site uses it: "Git 101, Sept 2024" → "git-101-sept-2024". */
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** A folder name as a title: "git-101-sept-2024" → "Git 101 Sept 2024". */
export const title = (s) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

/** The new manifest: folders processed this time replace their old photos as a whole; every other folder's photos are kept,
    so someone with only this week's photos on their computer doesn't wipe the gallery. Sorted by folder, then photo number. */
export function mergeManifest(old, fresh, processed) {
  const redone = new Set(processed);
  return [...old.filter((p) => !redone.has(p.event)), ...fresh].sort((a, b) => a.event.localeCompare(b.event) || a.index - b.index);
}

/** Each folder in the manifest once, with how many photos it has: what the content editor offers to pick from. */
export function folders(manifest) {
  const out = new Map();
  for (const p of manifest) out.set(p.event, { folder: p.event, title: p.eventTitle, photos: (out.get(p.event)?.photos ?? 0) + 1 });
  return [...out.values()];
}

/** Every folder the Memories content names (the opening photo and each moment), once each, in order. */
export function usedFolders(memories) {
  const named = [memories?.cover?.folder, ...(memories?.chapters ?? []).flatMap((c) => (c?.moments ?? []).map((m) => m?.folder))];
  return [...new Set(named.map((f) => (f ?? "").trim()).filter(Boolean))];
}

/** Folders the Memories content names that have no photos in the manifest: their moments show no photos until they're processed. */
export const missingFolders = (manifest, memories) => usedFolders(memories).filter((f) => !manifest.some((p) => p.event === f));

/** The editor's folder choices. A choice list refuses to open a saved value it doesn't know, so a folder the content
    still names but the gallery no longer has (or never had) stays on the list, marked, instead of locking the whole form. */
export function folderOptions(manifest, memories) {
  return [
    { label: "No photos yet", value: "" },
    ...folders(manifest).map((f) => ({ label: `${f.folder} (${f.photos} photo${f.photos === 1 ? "" : "s"})`, value: f.folder })),
    ...missingFolders(manifest, memories).map((f) => ({ label: `${f} (no photos found: a maintainer needs to run the photo script for it)`, value: f })),
  ];
}
