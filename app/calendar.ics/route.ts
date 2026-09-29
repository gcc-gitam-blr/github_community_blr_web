import { CLUB } from "@/lib/config";
import { EVENTS, icsFor, icsResponse } from "@/lib/events";
import { SITE_URL } from "@/lib/site";

/* The year's events as one iCalendar file — import once, get every event in Google/Apple/Outlook. */
export const dynamic = "force-static";

export function GET() {
  return icsResponse(icsFor(EVENTS, `GitHub Community Club · ${CLUB.year}`, SITE_URL), "github-community-club-2026-27.ics");
}
