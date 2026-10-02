import { CLUB } from "./config";
import { EVENTS } from "./events";

/* Certificates of participation: one per person who actually attended (see the attendance table).
   Each has a public page at /certificates/<id> that anyone can open to check it's real. */
export const certificateUrl = (site: string, id: string) => `${site.replace(/\/$/, "")}/certificates/${id}`;
export const eventByDate = (date: string) => EVENTS.find((e) => e.date === date);
export const eventTitle = (date: string) => eventByDate(date)?.title ?? date;

/** LinkedIn's "Add licence or certification" form, filled in. */
export function linkedinUrl(i: { event: string; id: string; issued: string; site: string }) {
  const d = new Date(i.issued);
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME", name: `${eventTitle(i.event)} — Certificate of participation`, organizationName: CLUB.name,
    issueYear: String(d.getFullYear()), issueMonth: String(d.getMonth() + 1), certUrl: certificateUrl(i.site, i.id), certId: i.id.slice(0, 8).toUpperCase(),
  });
  return `https://www.linkedin.com/profile/add?${q}`;
}

/** Short, human-friendly certificate number printed on the certificate (first 8 hex of the id). */
export const certNumber = (id: string) => `GCC-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
