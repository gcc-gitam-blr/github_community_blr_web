import { CLUB } from "./config";
import { MIN_FILL_MS } from "./join";

/* Anonymous event feedback: shared by the form and /api/feedback. */
export interface FeedbackInput { event: string; rating: number; liked?: string; improve?: string; website?: string; elapsedMs?: number }
export type FeedbackResult = { ok: true } | { ok: false; error: string };

export function validateFeedback(i: FeedbackInput): string | null {
  if (i.website) return "spam";
  if (i.elapsedMs !== undefined && i.elapsedMs < 1200) return "spam"; // a rating can be quick, but not instant
  if (!CLUB.events.some((e) => e.date === i.event)) return "That event doesn't exist.";
  if (!Number.isInteger(i.rating) || i.rating < 1 || i.rating > 5) return "Pick a rating from 1 to 5.";
  if ((i.liked ?? "").length > 1000 || (i.improve ?? "").length > 1000) return "Please keep each answer under 1000 characters.";
  return null;
}
export { MIN_FILL_MS };
