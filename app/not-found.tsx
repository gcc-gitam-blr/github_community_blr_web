import Link from "next/link";
import { Sticker } from "@/components/ui/Sticker";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-start justify-center gap-6 px-6 py-24 md:flex-row md:items-center md:gap-16">
        <Sticker name="waldo" size={220} tilt={-6} alt="Waldocat, searching" />
        <div>
          <p className="font-mono text-[14px] text-ink-3">error: pathspec did not match any file(s) known to git</p>
          <h1 className="mt-3 text-[clamp(36px,5vw,64px)]">404 — this branch doesn&apos;t exist.</h1>
          <p className="mt-4 max-w-[46ch] text-[18px] text-ink-2">The page may have moved, or the link had a typo. Let&apos;s get you back on main.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/" className="rounded-md bg-ink px-5 py-3 font-mono text-[14px] font-bold text-white">git checkout main</Link>
            <Link href="/epoch" className="font-semibold text-link">Go to Epoch →</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
