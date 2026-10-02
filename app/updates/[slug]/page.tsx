import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@primer/octicons-react";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { UpdateTag } from "@/components/site/UpdateTag";
import { CLUB } from "@/lib/config";
import { SITE_URL } from "@/lib/site";
import { getUpdate, getUpdates, updateDate } from "@/lib/updates";

export const dynamicParams = false;
export const generateStaticParams = () => getUpdates().map((u) => ({ slug: u.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const u = getUpdate((await params).slug);
  if (!u) return {};
  return { title: u.title, description: u.summary, openGraph: { title: u.title, description: u.summary, type: "article", publishedTime: u.date }, alternates: { types: { "application/rss+xml": "/updates/feed.xml" } } };
}

export default async function UpdatePage({ params }: { params: Promise<{ slug: string }> }) {
  const u = getUpdate((await params).slug);
  if (!u) notFound();
  const all = getUpdates(), i = all.indexOf(u), newer = all[i - 1], older = all[i + 1];
  const jsonLd = { "@context": "https://schema.org", "@type": "NewsArticle", headline: u.title, description: u.summary, datePublished: u.date, url: `${SITE_URL}/updates/${u.slug}`, publisher: { "@type": "Organization", name: CLUB.name, url: SITE_URL } };

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main id="main" className="mx-auto w-full max-w-[1040px] px-5 pb-24 pt-[120px] md:px-10">
        <Link href="/updates" className="mb-8 inline-flex items-center gap-2 text-[14px] text-link hover:underline"><ArrowLeftIcon size={16} />All updates</Link>
        <article className="rounded-[12px] border border-line bg-white">
          <header className="border-b border-line p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-3 text-[14px]"><time dateTime={u.date} className="font-semibold">{updateDate(u.date)}</time><UpdateTag tag={u.tag} /></div>
            <h1 className="mt-3 max-w-[22ch] text-[clamp(30px,4.4vw,46px)] leading-[1.05]">{u.title}</h1>
            <p className="mt-3 max-w-[60ch] text-[18px] leading-relaxed text-ink-2">{u.summary}</p>
          </header>
          {/* the body is the club's own Markdown from content/updates, rendered at build time */}
          <div className="post max-w-[72ch] p-6 sm:p-10" dangerouslySetInnerHTML={{ __html: u.html }} />
        </article>
        <nav aria-label="More updates" className="mt-10 grid gap-3 sm:grid-cols-2">
          {older ? <Link href={`/updates/${older.slug}`} className="rounded-[12px] border border-line p-4 transition hover:border-ink"><span className="text-[13px] text-ink-3">← Earlier</span><span className="mt-1 block font-semibold">{older.title}</span></Link> : <span />}
          {newer && <Link href={`/updates/${newer.slug}`} className="rounded-[12px] border border-line p-4 text-right transition hover:border-ink"><span className="text-[13px] text-ink-3">Newer →</span><span className="mt-1 block font-semibold">{newer.title}</span></Link>}
        </nav>
        <p className="mt-10 text-center"><Link href="/#join" className="font-semibold text-link">Not a member yet? Join the club →</Link></p>
      </main>
      <SiteFooter />
    </>
  );
}
