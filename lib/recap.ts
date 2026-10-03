import gallery from "./gallery.json";
import { eventSlug, type ClubEvent } from "./events";
import type { Photo } from "@/components/site/PhotoGrid";

/* An event's recap: what happened, in numbers, photos, a video and the slides.
   Photos come from the gallery (scripts/photos.mjs): the folder named by `recap.photos`, or the event's slug. */
export type Recap = NonNullable<ClubEvent["recap"]>;

export const recapPhotos = (e: ClubEvent, recap: Recap, photos = gallery as Photo[]) =>
  photos.filter((p) => p.event === (recap.photos ?? eventSlug(e)));

/** A YouTube video id from any of its link shapes (watch, youtu.be, shorts, embed, live), or null. */
export function youtubeId(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") id = u.pathname === "/watch" ? u.searchParams.get("v") : u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
