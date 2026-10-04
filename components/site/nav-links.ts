import { MEMORIES_LINKED } from "@/lib/memories";

/* The header's links (shared by the desktop bar and the phone menu). Memories joins once it has real photos. */
export const NAV_LINKS: { label: string; href: string; blurb: string }[] = [
  { label: "Learn", href: "/learn", blurb: "A path from your first commit, plus a Git cheat sheet" },
  { label: "Events", href: "/#events", blurb: "The 2026-27 calendar, RSVPs and recaps" },
  { label: "Updates", href: "/updates", blurb: "Club news and what GitHub shipped lately" },
  { label: "About", href: "/#about", blurb: "Who we are, the team, and the FAQ" },
  ...(MEMORIES_LINKED ? [{ label: "Memories", href: "/memories", blurb: "The club's story, one year at a time" }] : []),
];
