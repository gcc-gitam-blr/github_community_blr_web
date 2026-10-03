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
