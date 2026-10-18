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
    startTask: "CERTIFICATION_NAME", name: `${eventTitle(i.event)}: Certificate of participation`, organizationName: CLUB.name,
    issueYear: String(d.getFullYear()), issueMonth: String(d.getMonth() + 1), certUrl: certificateUrl(i.site, i.id), certId: i.id.slice(0, 8).toUpperCase(),
  });
  return `https://www.linkedin.com/profile/add?${q}`;
}

/** Short, human-friendly certificate number printed on the certificate (first 8 hex of the id). */
export const certNumber = (id: string) => `GCC-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

/* Each event's certificate has its own look, taken from the event itself: its timeline colour and shape (set in the
   content editor), and a sticker and wording for its kind. Epoch, the flagship, is gold. */
type EventLike = { type?: string; color?: string; shape?: string; href?: string } | undefined;
export const CERT_THEMES = {
  blue: { tint: "#b9e0f7", deep: "#0550ae", soft: "#eef8fe" },
  purple: { tint: "#d9c8f7", deep: "#6639ba", soft: "#f6f1fe" },
  mint: { tint: "#bfeedd", deep: "#0b6b52", soft: "#eefaf5" },
  green: { tint: "#b4ecbb", deep: "#116329", soft: "#effbf1" },
  gold: { tint: "#ffe28f", deep: "#7d4e00", soft: "#fff9e3" },
} as const;
export type CertTheme = (typeof CERT_THEMES)[keyof typeof CERT_THEMES];
const flagship = (e: EventLike) => e?.type === "Flagship" || e?.href === "/epoch";
export const certTheme = (e: EventLike): CertTheme => (flagship(e) ? CERT_THEMES.gold : CERT_THEMES[(e?.color as keyof typeof CERT_THEMES) ?? "green"] ?? CERT_THEMES.green);
const KIND: Record<string, { line: string; sticker: "professor" | "jetpack" | "founder" | "swag" | "octocat" }> = {
  Workshop: { line: "a hands-on workshop", sticker: "professor" },
  "Open Source": { line: "an open-source event", sticker: "jetpack" },
  Career: { line: "a careers session", sticker: "founder" },
  Flagship: { line: "the club's flagship fest", sticker: "swag" },
};
export const certKind = (e: EventLike) => KIND[flagship(e) ? "Flagship" : e?.type ?? ""] ?? { line: "an event", sticker: "octocat" as const };
