/* The club's logo mark (the Octocat circle from public/icons/github_community_logo.png, via scripts/brand.mjs),
   set on the club's black circle so it works on any background. Decorative: the link around it carries the name. */
export function ClubMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span aria-hidden className={`inline-grid flex-none place-items-center rounded-full bg-ink ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/club-mark.png" alt="" width={Math.round(size * 0.82)} height={Math.round(size * 0.82)} className="select-none" draggable={false} />
    </span>
  );
}
