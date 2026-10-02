import { LinkExternalIcon, RssIcon } from "@primer/octicons-react";
import { CHANGELOG_URL, getChangelog, type ChangelogEntry } from "@/lib/github-changelog";

/* "What GitHub shipped lately": live headlines from the GitHub Changelog, each linking to GitHub's own post.
   Renders nothing if the feed can't be reached. */
const TOPIC: Record<string, string> = {
  Copilot: "bg-[#fbefff] text-[#6e40c9] border-[#c297ff66]",
  Security: "bg-[#ffebe9] text-[#a40e26] border-[#ff818266]",
  Actions: "bg-[#ddf4ff] text-[#0550ae] border-[#54aeff66]",
  "Pull requests": "bg-[#dafbe1] text-[#116329] border-[#4ac26b66]",
};
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Row({ e }: { e: ChangelogEntry }) {
  return (
    <li className="grid gap-1 px-5 py-4 transition hover:bg-soft sm:grid-cols-[76px_1fr] sm:gap-5">
      <time dateTime={e.date} className="pt-0.5 font-mono text-[12.5px] text-ink-3">{day(e.date)}</time>
      <div className="min-w-0">
        <span className={`mr-2 inline-block rounded-full border px-2 py-px align-[2px] text-[11.5px] font-semibold ${TOPIC[e.topic] ?? "border-line bg-soft text-ink-2"}`}>{e.topic}</span>
        <a href={e.url} target="_blank" rel="noopener" className="font-semibold leading-snug hover:text-link hover:underline">{e.title}<span className="sr-only"> (opens the GitHub Changelog)</span></a>
        <p className="mt-1 text-[14.5px] leading-snug text-ink-2">{e.summary}</p>
      </div>
    </li>
  );
}

export async function GitHubChangelog({ variant }: { variant: "home" | "full" }) {
  const entries = await getChangelog(variant === "home" ? 4 : 12);
  if (!entries.length) return null;

  const list = (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-soft px-5 py-3 text-[13px] text-ink-2">
        <span className="flex items-center gap-2 font-mono"><span className="h-2 w-2 rounded-full bg-[#2da44e]" aria-hidden />github.blog/changelog</span>
        <span>updated hourly</span>
      </div>
      <ol className="divide-y divide-line">{entries.map((e) => <Row key={e.url} e={e} />)}</ol>
    </div>
  );
  const links = (
    <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14.5px]">
      <a href={CHANGELOG_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-link hover:underline">Everything on the GitHub Changelog <LinkExternalIcon size={14} /></a>
      <a href={`${CHANGELOG_URL}feed/`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-ink-2 hover:underline"><RssIcon size={14} />GitHub&apos;s RSS feed</a>
    </p>
  );

  if (variant === "full") return (
    <section aria-labelledby="gh-changelog" className="mt-16">
      <p className="font-mono text-[13px] text-ink-3">{"// shipped on github"}</p>
      <h2 id="gh-changelog" className="mt-2 text-[clamp(28px,3.4vw,40px)] leading-tight">What GitHub shipped lately</h2>
      <p className="mb-6 mt-2 max-w-[62ch] text-[16.5px] text-ink-2">Straight from GitHub&apos;s own changelog. Knowing what&apos;s new is half of knowing GitHub.</p>
      {list}{links}
    </section>
  );

  return (
    <section id="shipped" aria-labelledby="gh-changelog">
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-5 md:px-[clamp(20px,5vw,72px)] lg:grid-cols-[.8fr_1.2fr] lg:gap-14">
        <div>
          <p className="font-mono text-[13px] text-ink-2">{"// shipped on github"}</p>
          <h2 id="gh-changelog" className="mt-4 text-[clamp(32px,4.2vw,52px)]">What GitHub<br />shipped lately.</h2>
          <p className="mt-4 max-w-[44ch] text-[17px] text-ink-2">GitHub changes every week. These are the latest headlines from its official changelog — the same news developers get in their inbox.</p>
          {links}
        </div>
        {list}
      </div>
    </section>
  );
}
