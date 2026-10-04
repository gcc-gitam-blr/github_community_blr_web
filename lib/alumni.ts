import data from "@/content/club/alumni.json";

/* Alumni: where past members went. Added in the content editor (Alumni), and shown only when the box
   "They said yes to being listed" is ticked, so nobody appears without agreeing to it. Newest club years first. */
export interface Alum { name: string; years: string; role?: string; now: string; link?: string; handle: string; photo?: string; quote?: string }
type Raw = { [K in keyof Alum]?: string | null } & { consent?: boolean };

export const toAlumni = (rows: Raw[]): Alum[] => rows
  .filter((a) => a.consent && a.name?.trim() && a.now?.trim())
  .map((a) => ({ name: a.name!.trim(), years: a.years?.trim() || "", role: a.role?.trim() || undefined, now: a.now!.trim(), link: a.link || undefined, handle: a.handle?.trim().replace(/^@/, "") || "", photo: a.photo || undefined, quote: a.quote?.trim() || undefined }))
  .sort((a, b) => b.years.localeCompare(a.years) || a.name.localeCompare(b.name));

export const ALUMNI = toAlumni(data.alumni as Raw[]);
