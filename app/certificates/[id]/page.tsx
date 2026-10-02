import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { CertActions, CertQR } from "@/components/site/CertActions";
import { CLUB } from "@/lib/config";
import { certNumber, certificateUrl, eventByDate, linkedinUrl } from "@/lib/certificates";
import { eventDate } from "@/lib/events";
import { SITE_URL } from "@/lib/site";
import { ClubMark } from "@/components/ui/ClubMark";

/* A certificate of participation, and its public proof: whoever opens this link sees who it was issued to and for
   which event, read straight from the club's attendance records. Prints as one A4 landscape page. */
export const dynamic = "force-dynamic";
type Cert = { name: string; event: string; handle: string | null; issued: string };

async function load(id: string): Promise<Cert | null> {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !KEY || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createClient(URL, KEY, { auth: { persistSession: false } }).rpc("certificate", { p_id: id });
  return (data as Cert[] | null)?.[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await load((await params).id);
  if (!c) return { title: "Certificate not found", robots: { index: false } };
  const title = eventByDate(c.event)?.title ?? c.event;
  return { title: `${c.name} — ${title}`, description: `Certificate of participation issued by ${CLUB.name}.`, robots: { index: false } };
}


export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await load(id);
  if (!c) notFound();
  const e = eventByDate(c.event);
  const url = certificateUrl(SITE_URL, id);
  const issued = new Date(c.issued).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main id="main" className="cert-page min-h-screen bg-soft px-4 py-10 print:bg-white print:p-0">
      <p className="no-print mx-auto mb-6 max-w-[1000px] text-center text-[14.5px] text-ink-2">
        <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-[#dafbe1] px-2.5 py-0.5 font-semibold text-[#116329]">✓ Verified</span>
        Issued by {CLUB.name} from its attendance records.
      </p>

      <article className="cert mx-auto aspect-[297/210] w-full max-w-[1000px] bg-[#fffdf8] p-[3.2%] shadow-[0_30px_80px_-30px_rgba(11,11,15,.35)] print:shadow-none">
        <div className="relative flex h-full flex-col border-[3px] border-ink p-[4.5%] outline outline-1 outline-offset-[6px] outline-ink/30">
          {/* a branch line along the left edge, merging into the seal: the club's motif */}
          <svg aria-hidden viewBox="0 0 40 400" preserveAspectRatio="none" className="absolute bottom-[8%] left-[2.2%] top-[8%] w-[2.4%]">
            <path d="M20 0V400" stroke="#0b0b0f" strokeWidth="3" /><circle cx="20" cy="60" r="7" fill="#3fc84e" stroke="#0b0b0f" strokeWidth="3" /><circle cx="20" cy="200" r="7" fill="#b48be6" stroke="#0b0b0f" strokeWidth="3" /><circle cx="20" cy="340" r="7" fill="#b9e0f7" stroke="#0b0b0f" strokeWidth="3" />
          </svg>

          <header className="flex items-center gap-3 pl-[4%]">
            <ClubMark size={44} className="max-sm:!h-8 max-sm:!w-8" />
            <div className="leading-tight">
              <p className="font-display text-[clamp(13px,1.8vw,19px)] font-bold">{CLUB.name}</p>
              <p className="text-[clamp(10px,1.2vw,13px)] text-ink-2">{CLUB.university}</p>
            </div>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-mono text-[clamp(10px,1.3vw,14px)] uppercase tracking-[0.25em] text-ink-2">Certificate of participation</p>
            <p className="mt-[2.2%] text-[clamp(12px,1.6vw,17px)] text-ink-2">This certifies that</p>
            <h1 className="mt-[1.2%] max-w-[90%] text-[clamp(28px,5.6vw,60px)] leading-[1.05]">{c.name}</h1>
            {c.handle && <p className="mt-1 font-mono text-[clamp(10px,1.3vw,14px)] text-ink-3">@{c.handle}</p>}
            <p className="mt-[2.2%] max-w-[70%] text-[clamp(12px,1.7vw,18px)] leading-relaxed text-ink-2">
              took part in <b className="text-ink">{e?.title ?? c.event}</b>{e ? <>, {e.type === "Workshop" ? "a hands-on workshop" : "an event"} held on {eventDate(e)} at {e.where}</> : null}.
            </p>
          </div>

          <footer className="grid grid-cols-[1fr_auto_1fr] items-end gap-4 pl-[4%]">
            <div className="text-[clamp(9px,1.1vw,12.5px)] leading-relaxed text-ink-2">
              <p>Issued {issued}</p>
              <p className="font-mono">No. {certNumber(id)}</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1 w-[clamp(110px,18vw,190px)] border-t-2 border-ink" />
              <p className="text-[clamp(9px,1.1vw,12.5px)] font-semibold">On behalf of the club</p>
            </div>
            <div className="flex items-end justify-end gap-3">
              <p className="hidden text-right text-[clamp(8px,1vw,11px)] leading-snug text-ink-3 sm:block">Scan to verify<br />{SITE_URL.replace(/^https?:\/\//, "")}</p>
              <div className="rounded bg-white p-1"><CertQR url={url} /></div>
            </div>
          </footer>
          <p className="mt-[1.6%] text-center text-[clamp(7px,0.85vw,10px)] text-ink-3">A student-run community. Not issued by or affiliated with GitHub, Inc.</p>
        </div>
      </article>

      <div className="mx-auto mt-8 max-w-[1000px] space-y-4">
        <CertActions linkedin={linkedinUrl({ event: c.event, id, issued: c.issued, site: SITE_URL })} />
        <p className="no-print text-center text-[14px]"><Link href="/" className="text-link hover:underline">{CLUB.name} →</Link></p>
      </div>
    </main>
  );
}
