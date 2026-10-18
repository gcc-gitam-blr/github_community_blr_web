/* One-key jumps for organisers: A opens the club admin, E the Epoch desk, from any page of the site.
   They only work on a device where someone has opened the admin as an organiser (so a visitor never jumps by
   accident), never while typing, never in the content editor or on a public kiosk screen, and they can be turned
   off: single-key shortcuts must be, for people using speech input (WCAG 2.1.4). */
export const SHORTCUTS: Record<string, { href: string; label: string }> = {
  a: { href: "/admin", label: "Club admin" },
  e: { href: "/epoch/admin", label: "Epoch desk" },
};
export const ORGANISER_KEY = "gcc-organiser"; // set by the admin for organisers, cleared on sign-out
export const OFF_KEY = "gcc-shortcuts-off";    // set when someone turns the shortcuts off on this device
const QUIET = [/^\/keystatic/, /^\/epoch\/kiosk/, /^\/epoch\/screen/]; // typing or public screens: no jumps there

export interface KeyLike {
  key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; repeat?: boolean; defaultPrevented?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
}

/** Where this key press should go, or null to leave it alone. */
export function shortcutFor(e: KeyLike, path: string): string | null {
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return null;
  const tag = e.target?.tagName?.toLowerCase();
  if (e.target?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select") return null;
  if (QUIET.some((q) => q.test(path))) return null;
  const s = SHORTCUTS[(e.key ?? "").toLowerCase()];
  return s && path !== s.href ? s.href : null;
}
