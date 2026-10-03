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

/* Preview deployments show a sample recap on the first event, so the layout can be judged before a real one exists.
   It never builds into production. Locally: RECAP_SAMPLE=1 npm run dev. */
export const SHOW_SAMPLE = process.env.VERCEL_ENV === "preview" || process.env.RECAP_SAMPLE === "1";

const tile = (i: number, w: number, h: number) => {
  const fill = ["#ddf4ff", "#fbefff", "#dafbe1", "#fff8c5"][i % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${fill}"/><text x="50%" y="50%" font-family="monospace" font-size="${Math.round(w / 14)}" fill="#59636e" text-anchor="middle" dominant-baseline="middle">photo ${i + 1}</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
};
const SAMPLE_SIZES = [[960, 640], [640, 800], [960, 720], [960, 540], [640, 640], [960, 640]];

export const SAMPLE_RECAP: Recap = {
  text: "Sample recap: this is how a real one will look. Two or three short paragraphs about what happened: who came, what people built, the moment the room cheered when the first pull request merged.\n\nAdd the photos with scripts/photos.mjs and fill this in from the content editor after the event.",
  numbers: [{ value: 84, label: "came" }, { value: 37, label: "first pull requests" }, { value: 6, label: "mentors" }],
  slides: "https://github.com",
};
export const samplePhotos = (e: ClubEvent): Photo[] =>
  SAMPLE_SIZES.map(([w, h], i) => ({ id: `sample-${i + 1}`, event: eventSlug(e), eventTitle: e.title, index: i + 1, w, h, alt: `Sample photo ${i + 1}`, caption: `Sample photo ${i + 1}`, src: tile(i, w, h) }));
