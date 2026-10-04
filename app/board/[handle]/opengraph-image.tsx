import { ImageResponse } from "next/og";
import { badgesByMember } from "@/lib/badges";
import { boardMembers, counted, loadBoard } from "@/lib/board";
import { CHALLENGE, challengeState } from "@/lib/challenge";

/* Share card for a member's page: their name, what they merged, and their badges. */
export const alt = "Open-source contributions on the GitHub Community Club board";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;
export const generateStaticParams = () => boardMembers().map((m) => ({ handle: m.handle.toLowerCase() }));

const COLORS: Record<string, [string, string]> = { "first-merge": ["#fbefff", "#8250df"], "five-merged": ["#fff8c5", "#9a6700"], "ten-merged": ["#ffebe9", "#cf222e"], "three-projects": ["#ddf4ff", "#0550ae"], challenge: ["#dafbe1", "#1a7f37"] };

export default async function OG({ params }: { params: Promise<{ handle: string }> }) {
  const handle = (await params).handle;
  const member = boardMembers().find((m) => m.handle.toLowerCase() === handle.toLowerCase())!;
  const { prs, members } = await loadBoard();
  const mine = counted(prs, [member]);
  const challenge = CHALLENGE && challengeState(CHALLENGE) !== "upcoming" ? CHALLENGE : undefined;
  const badges = badgesByMember(prs, members, challenge).get(member.handle.toLowerCase()) ?? [];
  const repos = new Set(mine.map((p) => p.repo)).size;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: 72, fontFamily: "sans-serif", borderTop: "16px solid #8250df" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* initials, not their avatar: a download that fails mid-build mustn't break the site */}
          <span style={{ width: 120, height: 120, borderRadius: 60, border: "4px solid #0b0b0f", background: "#b9e0f7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 800, color: "#0b0b0f" }}>{member.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2, color: "#0b0b0f" }}>{member.name}</span>
            <span style={{ fontSize: 30, color: "#57606a", fontFamily: "monospace" }}>@{member.handle}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 48, fontSize: 40, color: "#0b0b0f" }}>
          <span><b>{mine.length}</b> merged</span><span><b>{repos}</b> {repos === 1 ? "project" : "projects"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, maxWidth: 800 }}>
            {badges.length ? badges.map((b) => <span key={b.id} style={{ fontSize: 28, fontWeight: 700, padding: "8px 22px", borderRadius: 40, background: COLORS[b.id][0], color: COLORS[b.id][1] }}>{b.name}</span>)
              : <span style={{ fontSize: 28, color: "#57606a" }}>First merge on the way</span>}
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#0b0b0f" }}>GitHub Community Club</span>
        </div>
      </div>
    ),
    size,
  );
}
