import { ImageResponse } from "next/og";
import { EVENTS, eventDate, eventSlug, eventTag, findEvent } from "@/lib/events";

/* Share card for one event, styled like a release. */
export const alt = "A GitHub Community Club event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const generateStaticParams = () => EVENTS.map((e) => ({ slug: eventSlug(e) }));

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const e = findEvent((await params).slug)!;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: 72, fontFamily: "sans-serif", borderTop: `24px solid ${e.href ? "#ffc933" : "#2ea043"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30, color: "#3a3d44" }}>
          <span style={{ border: "3px solid #d0d7de", borderRadius: 40, padding: "6px 20px", fontFamily: "monospace" }}>{eventTag(e)}</span>
          <span>{e.type}</span>
        </div>
        <div style={{ display: "flex", fontSize: e.title.length > 34 ? 76 : 96, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, color: "#0b0b0f" }}>{e.title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "#3a3d44" }}>
          <span>{eventDate(e)} · {e.where}</span>
          <span style={{ fontWeight: 700, color: "#0b0b0f" }}>GitHub Community Club</span>
        </div>
      </div>
    ),
    size,
  );
}
