import { EVENTS, eventSlug, findEvent, icsFor, icsResponse } from "@/lib/events";
import { SITE_URL } from "@/lib/site";

/* One event as an iCalendar file: /events/<slug>/event.ics */
export const dynamic = "force-static";
export const generateStaticParams = () => EVENTS.map((e) => ({ slug: eventSlug(e) }));

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = findEvent((await params).slug);
  if (!e) return new Response("Not found", { status: 404 });
  return icsResponse(icsFor([e], e.title, SITE_URL), `${eventSlug(e)}.ics`);
}
