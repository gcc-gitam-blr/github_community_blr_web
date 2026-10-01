import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { verifyToken } from "@/lib/email/token";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ e?: string; t?: string; done?: string; bad?: string }> }) {
  const { e = "", t = "", done, bad } = await searchParams;
  const valid = !!e && verifyToken(e, t);
  return (
    <>
      <Nav />
      <main className="mx-auto min-h-[70vh] w-full max-w-[560px] px-5 pb-24 pt-[140px]">
        {done ? (<>
          <h1 className="text-[40px]">You&apos;re unsubscribed.</h1>
          <p className="mt-4 text-[18px] text-ink-2">We won&apos;t email you again. You&apos;re always welcome at our events — they&apos;re announced in the WhatsApp community and on Instagram.</p>
        </>) : valid ? (<>
          <h1 className="text-[40px]">Unsubscribe from club emails?</h1>
          <p className="mt-4 text-[18px] text-ink-2">We&apos;ll stop sending event updates to <b>{e}</b>.</p>
          <form method="post" action="/api/unsubscribe" className="mt-8">
            <input type="hidden" name="e" value={e} /><input type="hidden" name="t" value={t} />
            <button className="rounded-md bg-ink px-6 py-3 font-display font-bold text-white">Yes, unsubscribe me</button>
          </form>
        </>) : (<>
          <h1 className="text-[40px]">That link doesn&apos;t work.</h1>
          <p className="mt-4 text-[18px] text-ink-2">{bad ? "We couldn't process that request." : "It may be incomplete or have been changed."} Use the unsubscribe link from the latest email, or message the club on WhatsApp and we&apos;ll remove you.</p>
        </>)}
        <p className="mt-10"><Link href="/" className="font-semibold text-link">← Back to the club site</Link></p>
      </main>
      <SiteFooter />
    </>
  );
}
