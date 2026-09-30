import { MarkGithubIcon } from "@primer/octicons-react";
import { CLUB } from "@/lib/config";

/* The club's official accounts, with their own icons. Instagram and LinkedIn marks are simple
   inline SVGs so no extra icon library is needed. */
const Instagram = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" /></svg>
);
const LinkedIn = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden><path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.2c0-1.24-.02-2.84-1.73-2.84-1.73 0-2 1.35-2 2.75V21h-4z" /></svg>
);

const ICONS: Record<string, (p: { size?: number }) => React.ReactElement> = { Instagram, LinkedIn };

export function socialLinks() {
  const org = CLUB.githubOrg ? [{ label: "GitHub", href: `${CLUB.githubUrl}/${CLUB.githubOrg}` }] : [];
  return [...org, ...CLUB.socials.filter((s) => s.href && s.href !== "#")];
}

/** Round icon buttons. `tone="dark"` for the footer, `"light"` for white backgrounds. */
export function SocialLinks({ tone = "light", size = 44 }: { tone?: "light" | "dark"; size?: number }) {
  const links = socialLinks();
  if (!links.length) return null;
  const cls = tone === "dark"
    ? "border-[#30363d] bg-[#161b22] text-[#e6edf3] hover:border-[#8b949e] hover:bg-[#21262d]"
    : "border-line bg-white text-ink hover:border-ink";
  return (
    <ul className="flex flex-wrap gap-2.5">
      {links.map((l) => {
        const Icon = ICONS[l.label];
        return (
          <li key={l.label}>
            <a href={l.href} target="_blank" rel="noopener" aria-label={`${CLUB.name} on ${l.label}`} title={l.label}
              style={{ width: size, height: size }} className={`grid place-items-center rounded-full border transition ${cls}`}>
              {Icon ? <Icon /> : <MarkGithubIcon size={18} />}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
