import type { Photo } from "@/components/site/PhotoGrid";

/* Photo uploads from the browser (/photos). The browser resizes each photo to three WebP sizes, which also removes the
   camera and location data, so only small, clean images ever reach the repository. The server adds them to the gallery
   folder you pick and to lib/gallery.json in one commit, using your content-editor (GitHub) login. */
export const SIZES = [{ w: 480, s: "sm" }, { w: 960, s: "md" }, { w: 1800, s: "lg" }] as const;
export const MAX_PER_UPLOAD = 30;
export const MAX_IMAGE_BYTES = 1_500_000; // one resized WebP; a 1800px photo is usually 200–500 KB
export const REPO = "lechakrawarthy/github_community_blr", BRANCH = "main";

export const folderOk = (f: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f) && f.length <= 80;
export const toFolder = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
/** WebP files start with RIFF....WEBP; anything else is refused. */
export const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";

/** Adds photos to the gallery manifest: numbered after what the folder already has, so nothing is overwritten. */
export function addToManifest(manifest: Photo[], folder: string, title: string, photos: { w: number; h: number; caption?: string }[]) {
  const start = Math.max(0, ...manifest.filter((p) => p.event === folder).map((p) => p.index));
  const added: Photo[] = photos.map((p, i) => {
    const index = start + i + 1, caption = (p.caption ?? "").trim().slice(0, 200);
    return { id: `${folder}-${String(index).padStart(2, "0")}`, event: folder, eventTitle: title, index, w: p.w, h: p.h, alt: caption || `${title} — photo ${index}`, caption };
  });
  return { manifest: [...manifest, ...added], added };
}
