import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { CertActions } from "@/components/site/CertActions";
import { Certificate } from "@/components/site/Certificate";
import { CLUB } from "@/lib/config";
import { certNumber, certificateUrl, eventByDate, linkedinUrl } from "@/lib/certificates";
import { EVENTS } from "@/lib/events";
import { SITE_URL } from "@/lib/site";

/* A certificate of participation, and its public proof: whoever opens this link sees who it was issued to and for
   which event, read straight from the club's attendance records. Prints as one A4 landscape page.
   /certificates/sample shows every event's design with a made-up name: on preview deployments, in `npm run dev`, or with CERT_SAMPLE=1. */
export const dynamic = "force-dynamic";
type Cert = { name: string; event: string; handle: string | null; issued: string };
const SAMPLES_ON = process.env.VERCEL_ENV === "preview" || process.env.CERT_SAMPLE === "1" || process.env.NODE_ENV === "development";
const SAMPLE_ID = "00000000-0000-4000-8000-0000000c0ffe";
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

async function load(id: string): Promise<Cert | null> {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !KEY || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createClient(URL, KEY, { auth: { persistSession: false } }).rpc("certificate", { p_id: id });
  return (data as Cert[] | null)?.[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (id === "sample" && SAMPLES_ON) return { title: "Certificate designs (sample)", robots: { index: false } };
  const c = await load(id);
  if (!c) return { title: "Certificate not found", robots: { index: false } };
  const title = eventByDate(c.event)?.title ?? c.event;
  return { title: `${c.name}: ${title}`, description: `${c.name} took part in ${title}. Certificate of participation issued by ${CLUB.name}.`, robots: { index: false } };
}

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "sample" && SAMPLES_ON) return <Samples />;
  const c = await load(id);
  if (!c) notFound();
  const url = certificateUrl(SITE_URL, id);
  return (
    <main id="main" className="cert-page min-h-screen bg-soft px-4 py-10 print:bg-white print:p-0">
      <p className="no-print mx-auto mb-6 max-w-[1040px] text-center text-[14.5px] text-ink-2">
        <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-[#dafbe1] px-2.5 py-0.5 font-semibold text-[#116329]">✓ Verified</span>
        Issued by {CLUB.name} from its attendance records.
      </p>
      <Certificate name={c.name} handle={c.handle} event={eventByDate(c.event)} eventKey={c.event} issued={fmt(c.issued)} number={certNumber(id)} url={url} />
      <div className="mx-auto mt-8 max-w-[1040px] space-y-4">
        <CertActions linkedin={linkedinUrl({ event: c.event, id, issued: c.issued, site: SITE_URL })} />
        <p className="no-print text-center text-[14px]"><Link href="/" className="text-link hover:underline">{CLUB.name} →</Link></p>
      </div>
    </main>
  );
}

/** Every event's certificate with a made-up name, so the team can see the designs before anyone is issued one. */
function Samples() {
  return (
    <main id="main" className="min-h-screen bg-soft px-4 py-10">
      <div className="mx-auto max-w-[1040px]">
        <p className="rounded-lg border border-[#d4a72c66] bg-[#fff8c5] px-4 py-3 text-[15px] text-[#7d4e00]">Sample certificates with a made-up name, one per event, so the designs can be checked. Only on preview deployments and locally; the live site never shows this page.</p>
        <div className="mt-8 space-y-12">
          {EVENTS.map((e) => (
            <section key={e.date} aria-label={`Sample certificate for ${e.title}`}>
              <p className="mb-3 font-mono text-[13px] text-ink-2">{e.date} · {e.type} · {e.color} {e.shape}</p>
              <Certificate name="Ada Lovelace" handle="octocat" event={e} eventKey={e.date} issued={fmt(e.date)} number={certNumber(SAMPLE_ID)} url={certificateUrl(SITE_URL, SAMPLE_ID)} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
