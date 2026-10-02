import type { Metadata } from "next";
import Link from "next/link";
import { RssIcon } from "@primer/octicons-react";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { UpdateTag } from "@/components/site/UpdateTag";
import { getUpdates, updateDate } from "@/lib/updates";
import { GitHubChangelog } from "@/components/site/GitHubChangelog";

export const metadata: Metadata = {
  title: "Updates",
  description: "News from the GitHub Community Club at GITAM Bengaluru — events, Epoch — and the latest from the GitHub Changelog.",
  alternates: { types: { "application/rss+xml": "/updates/feed.xml" } },
};

/* A changelog for the club: date on the left, the post on the right, newest first. */
export default function UpdatesPage() {
  const posts = getUpdates();
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto w-full max-w-[1040px] px-5 pb-24 pt-[120px] md:px-10">
        <p className="font-mono text-[13px] text-ink-3">{"// updates"}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
          <h1 className="text-[clamp(36px,5vw,56px)] leading-[1.02]">What&apos;s new at the club</h1>
          <a href="/updates/feed.xml" className="inline-flex items-center gap-2 rounded-md border border-line px-3.5 py-2 text-[14px] font-semibold transition hover:border-ink"><RssIcon size={16} />Follow with RSS</a>
        </div>

        <ol className="mt-4">
          {posts.map((p) => (
            <li key={p.slug} className="grid gap-2 border-b border-line py-8 md:grid-cols-[180px_1fr] md:gap-8">
              <div className="flex items-center gap-3 md:flex-col md:items-start md:pt-1.5">
                <time dateTime={p.date} className="text-[14px] font-semibold">{updateDate(p.date)}</time>
                <UpdateTag tag={p.tag} />
              </div>
              <article>
                <h2 className="text-[clamp(22px,2.6vw,28px)] leading-tight"><Link href={`/updates/${p.slug}`} className="hover:underline hover:underline-offset-4">{p.title}</Link></h2>
                <p className="mt-2 max-w-[62ch] text-[16.5px] leading-relaxed text-ink-2">{p.summary}</p>
              </article>
            </li>
          ))}
        </ol>

        <GitHubChangelog variant="full" />
      </main>
      <SiteFooter />
    </>
  );
}
