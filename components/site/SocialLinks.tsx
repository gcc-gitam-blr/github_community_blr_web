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

const WhatsApp = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.1-1.3c0-.1-.2-.2-.5-.3z" /></svg>
);

const ICONS: Record<string, (p: { size?: number }) => React.ReactElement> = { Instagram, LinkedIn, WhatsApp };

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
