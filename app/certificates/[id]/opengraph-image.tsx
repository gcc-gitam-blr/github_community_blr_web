import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { CLUB, commitHash } from "@/lib/config";
import { certTheme, eventByDate } from "@/lib/certificates";
import { EVENTS, eventDate, eventTag } from "@/lib/events";

/* The picture people see when a certificate link is shared on LinkedIn or WhatsApp: who, which event, in that event's
   colours. Every share is a small advert for the club, so it is worth getting right. */
export const alt = "A certificate of participation from the GitHub Community Club";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

async function load(id: string) {
  if (id === "sample") return { name: "Ada Lovelace", event: EVENTS[0]?.date ?? "" };
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !KEY || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createClient(URL, KEY, { auth: { persistSession: false } }).rpc("certificate", { p_id: id });
  return (data as { name: string; event: string }[] | null)?.[0] ?? null;
}

export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const c = await load((await params).id);
  const e = c ? eventByDate(c.event) : undefined, t = certTheme(e);
  const title = e?.title ?? "GitHub Community Club";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fffdf8", fontFamily: "sans-serif", border: "8px solid #0b0b0f" }}>
        <div style={{ width: 300, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", background: t.tint, borderRight: "6px solid #0b0b0f", padding: "56px 24px" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 900, textAlign: "center", lineHeight: 1.1 }}>GitHub Community Club</div>
          <div style={{ display: "flex", width: 120, height: 120, borderRadius: 60, border: "6px solid #0b0b0f", background: "#fffdf8", alignItems: "center", justifyContent: "center", fontSize: 54 }}>✓</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "monospace", fontSize: 24 }}>
            <span style={{ fontWeight: 700 }}>{e ? eventTag(e) : "v1.0.0"}</span>
            <span style={{ color: t.deep }}>commit {commitHash(title + (e?.date ?? ""))}</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 64px 56px" }}>
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: t.deep }}>Certificate of participation</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, color: "#3a3d44" }}>{c ? "This certifies that" : "A certificate from"}</div>
            <div style={{ display: "flex", fontSize: (c?.name.length ?? 0) > 22 ? 70 : 92, fontWeight: 900, letterSpacing: -3, lineHeight: 1.02, color: "#0b0b0f" }}>{c?.name ?? CLUB.name}</div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 36, color: "#3a3d44" }}>took part in&nbsp;<b style={{ color: "#0b0b0f" }}>{title}</b></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#3a3d44" }}>
            <span>{e ? `${eventDate(e)} · ${e.where}` : CLUB.university}</span>
            <span style={{ fontWeight: 700, color: "#116329" }}>✓ Verified</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
