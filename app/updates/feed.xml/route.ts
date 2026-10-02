import { CLUB } from "@/lib/config";
import { SITE_URL } from "@/lib/site";
import { getUpdates } from "@/lib/updates";

/* RSS 2.0 for the club updates — works in any feed reader, and in Slack/Discord feed bots. */
export const dynamic = "force-static";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// links inside a feed must be absolute
const absolute = (html: string) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${SITE_URL}/`);
const pub = (iso: string) => new Date(iso + "T09:00:00+05:30").toUTCString();

export function GET() {
  const posts = getUpdates();
  const items = posts.map((p) => [
    "    <item>",
    `      <title>${x(p.title)}</title>`,
    `      <link>${SITE_URL}/updates/${p.slug}</link>`,
    `      <guid isPermaLink="true">${SITE_URL}/updates/${p.slug}</guid>`,
    `      <pubDate>${pub(p.date)}</pubDate>`,
    `      <category>${x(p.tag)}</category>`,
    `      <description>${x(p.summary)}</description>`,
    `      <content:encoded><![CDATA[${absolute(p.html).replace(/]]>/g, "]]]]><![CDATA[>")}]]></content:encoded>`,
    "    </item>",
  ].join("\n"));
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">`,
    "  <channel>",
    `    <title>${x(CLUB.name)} — Updates</title>`,
    `    <link>${SITE_URL}/updates</link>`,
    `    <atom:link href="${SITE_URL}/updates/feed.xml" rel="self" type="application/rss+xml" />`,
    `    <description>Events, Epoch and news from the GitHub Community Club at ${x(CLUB.university)}.</description>`,
    "    <language>en-IN</language>",
    ...(posts[0] ? [`    <lastBuildDate>${pub(posts[0].date)}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
