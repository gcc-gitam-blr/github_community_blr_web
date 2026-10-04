import type { ClubEventData } from "./config";

/* The session materials archive (/learn): every session that has something to share, newest first.
   Built from each event's recap: its slides and video, then any extra links an organiser added in the editor. */
export type MaterialKind = "slides" | "recording" | "code" | "reading";
export interface Material { title: string; url: string; kind: MaterialKind }
export interface SessionMaterials { event: ClubEventData; items: Material[] }

export const MATERIAL_KINDS: { value: MaterialKind; label: string }[] = [
  { value: "slides", label: "Slides" }, { value: "recording", label: "Recording" }, { value: "code", label: "Code" }, { value: "reading", label: "Reading" },
];

export function sessionMaterials(events: ClubEventData[]): SessionMaterials[] {
  const out: SessionMaterials[] = [];
  for (const event of events) {
    const r = event.recap;
    if (!r) continue;
    const items: Material[] = [];
    if (r.slides) items.push({ title: "Slides", url: r.slides, kind: "slides" });
    if (r.video) items.push({ title: "Recording", url: r.video, kind: "recording" });
    for (const m of r.materials ?? []) if (!items.some((i) => i.url === m.url)) items.push(m); // the same link added twice shows once
    if (items.length) out.push({ event, items });
  }
  return out.sort((a, b) => b.event.date.localeCompare(a.event.date));
}
