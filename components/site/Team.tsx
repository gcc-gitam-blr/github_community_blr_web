import Link from "next/link";
import { CLUB } from "@/lib/config";
import { CREWS, LEVELS, ROLES, roleLabel, type CrewRole } from "@/lib/crew";
import { Reveal } from "@/components/ui/Reveal";
import { Head } from "./Sections";
import { Shuffled } from "./Shuffled";

/* The team, like a GitHub organisation: mentors (the owners), the five leads, then everyone else six to a row.
   Technical roles are shown as labels coloured by crew; "How our tech roles work" explains them. */
type Member = (typeof CLUB.team)[number];
type Person = { name: string; handle: string; photo?: string; githubAvatar?: boolean };

const pad = "py-[clamp(64px,8vw,112px)]";
const wrap = "mx-auto w-full max-w-[1240px] px-5 md:px-[clamp(20px,5vw,72px)]";
const NODE_BG = ["bg-node-blue", "bg-node-purple", "bg-node-mint", "bg-brand"];
const TONE = {
  purple: "border-[#c297ff66] bg-[#fbefff] text-[#6e40c9]",
  blue: "border-[#54aeff66] bg-[#ddf4ff] text-[#0550ae]",
  red: "border-[#ff818266] bg-[#ffebe9] text-[#a40e26]",
} as const;
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** A face: their photo, else their GitHub avatar, else their initials on a club colour. */
export function Face({ p, px, i, text }: { p: Person; px: number; i: number; text: string }) {
  if (p.photo) {
    const sm = p.photo.replace(/\.webp$/, "-sm.webp");
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={px > 120 ? p.photo : sm} srcSet={`${sm} 240w, ${p.photo} 480w`} sizes={`${px}px`} alt="" width={480} height={480} loading="lazy" className="h-full w-full object-cover" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  if (p.handle && p.githubAvatar !== false) return <img src={`https://github.com/${p.handle}.png?size=${Math.min(460, px * 2)}`} alt="" loading="lazy" className="h-full w-full object-cover" />;
  return <span className={`grid h-full w-full place-items-center font-display font-black tracking-tight text-ink/80 ${NODE_BG[i % NODE_BG.length]} ${text}`} aria-hidden>{initials(p.name)}</span>;
}

/** "Git Custodian I", as a label coloured by its crew. */
function CrewLabel({ r }: { r: CrewRole }) {
  const def = ROLES[r.role];
  return <span title={`${def.industry} · GitHub access: ${def.access}`} className={`inline-block rounded-md border px-1.5 py-px text-[12px] font-semibold leading-snug ${TONE[CREWS[def.crew].tone]}`}>{roleLabel(r)}</span>;
}
const Tag = ({ t }: { t: string }) => <span className="inline-block rounded-md border border-line bg-soft px-1.5 py-px text-[12px] font-medium text-ink-2">{t}</span>;

function Card({ m, i, big }: { m: Member; i: number; big: boolean }) {
  return (
    <Reveal as="li" delay={big ? (i % 6) * 0.05 : 0}>
      <div className="lift aspect-square overflow-hidden rounded-[18px] border-2 border-ink bg-soft"><Face p={m} px={big ? 240 : 200} i={i} text={big ? "text-[clamp(44px,5vw,64px)]" : "text-[clamp(36px,4vw,52px)]"} /></div>
      <h3 className={`mt-4 leading-tight ${big ? "text-[22px]" : "text-[19px]"}`}>{m.name}</h3>
      {m.role && <p className={`mt-1 font-semibold text-ink-2 ${big ? "text-[15px]" : "text-[14px]"}`}>{m.role}</p>}
      {/* hats first, then the technical role on its own line, so cards in a row line up */}
      {m.tags && <p className="mt-2 flex flex-wrap gap-1.5">{m.tags.map((t) => <Tag key={t} t={t} />)}</p>}
      {m.crew && <p className="mt-1.5 flex flex-wrap gap-1.5">{m.crew.map((r) => <CrewLabel key={r.role} r={r} />)}</p>}
      {m.handle && <a href={`https://github.com/${m.handle}`} target="_blank" rel="noopener" className="mt-1.5 block font-mono text-[13px] text-link hover:underline">@{m.handle}</a>}
    </Reveal>
  );
}

export function Team() {
  if (!CLUB.team.length) return null;
  const by = (g: Member["group"]) => CLUB.team.filter((m) => m.group === g);
  const mentors = by("mentor"), leads = by("lead"), members = by("member");
  const used = new Set(CLUB.team.flatMap((m) => m.crew?.map((r) => r.role) ?? []));

  return (
    <section id="team" className={pad}>
      <div className={wrap}>
        <Head tag={`// core team · ${CLUB.year}`} title="The maintainers.">Students like you, who decided to stop waiting and start organising. <Link href="/get-involved?kind=apply" className="font-semibold text-link hover:underline">Want to join them?</Link></Head>

        {mentors.length > 0 && (
          <Reveal className="mb-14">
            <p className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-display text-[18px] font-bold">Mentors</span><span className="font-mono text-[13px] text-ink-3">former leads who guide the club</span></p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {mentors.map((m, i) => (
                <li key={m.name} className="flex items-center gap-4 rounded-[16px] border-2 border-ink bg-white p-4">
                  <span className="h-16 w-16 flex-none overflow-hidden rounded-[14px] border-2 border-ink bg-soft"><Face p={m} px={64} i={i + 1} text="text-[24px]" /></span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-display text-[19px] font-bold leading-tight">{m.name}</span>{m.owner && <span className="rounded-full border border-[#d4a72c] bg-[#fff8c5] px-2 py-px text-[11.5px] font-semibold text-[#7d4e00]">Owner</span>}</span>
                    <span className="mt-1 block text-[14px] font-medium text-ink-2">{m.role}</span>
                    {m.past && <span className="mt-0.5 block text-[13px] text-ink-3">{m.past}</span>}
                    {m.handle && <a href={`https://github.com/${m.handle}`} target="_blank" rel="noopener" className="block font-mono text-[13px] text-link hover:underline">@{m.handle}</a>}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {/* the five leads, equal and a little larger… */}
        <ul className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
          {leads.map((m, i) => <Card key={m.name} m={m} i={i} big />)}
        </ul>
        {/* …then everyone else, six to a row, in a new order on every visit — it isn't a ranking */}
        {members.length > 0 && (
          <Shuffled className="mt-12 grid grid-cols-2 gap-x-4 gap-y-9 border-t border-line pt-12 sm:grid-cols-3 lg:grid-cols-6">
            {members.map((m, i) => <Card key={m.name} m={m} i={i + leads.length} big={false} />)}
          </Shuffled>
        )}

        {used.size > 0 && (
          <details className="group mt-12 rounded-[16px] border border-line bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <span><span className="font-display text-[18px] font-bold">How our tech roles work</span> <span className="ml-1 font-mono text-[13px] text-ink-3">levels I · II · III, like SD1 → SD3</span></span>
              <span aria-hidden className="text-ink-3 transition-transform duration-200 ease-out group-open:rotate-180">⌄</span>
            </summary>
            <div className="grid gap-6 border-t border-line px-5 py-6 sm:px-6 md:grid-cols-3">
              {CREWS.map((c, ci) => (
                <div key={c.name}>
                  <p className="font-mono text-[12.5px] uppercase tracking-wide text-ink-3">{c.name} crew</p>
                  <ul className="mt-3 space-y-4">
                    {Object.entries(ROLES).filter(([, r]) => r.crew === ci).map(([id, r]) => (
                      <li key={id}>
                        <span className={`inline-block rounded-md border px-1.5 py-px text-[12.5px] font-semibold ${TONE[c.tone]}`}>{r.title}</span>
                        <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{r.what}</p>
                        <p className="mt-1 text-[12.5px] text-ink-3">{r.industry} · GitHub access: {r.access}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3 sm:px-6">Level {LEVELS[0]} is where everyone starts; {LEVELS[1]} and {LEVELS[2]} come with experience and the trust to review others&apos; work.</p>
          </details>
        )}

        {CLUB.contributors.length > 0 && (
          <Reveal className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[16px] border border-line bg-white p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-[18px]">Contributors <span className="rounded-full bg-soft px-2 py-0.5 font-sans text-[12.5px] font-semibold text-ink-2">{CLUB.contributors.length}</span></h3>
            <Shuffled className="flex flex-wrap gap-2">
              {CLUB.contributors.map((c, i) => {
                const inner = (<><span className="h-7 w-7 flex-none overflow-hidden rounded-full" aria-hidden><Face p={c} px={28} i={i} text="text-[11px] font-bold" /></span>{c.name}</>);
                const cls = "inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3.5 text-[14.5px] font-medium";
                return <li key={c.name}>{c.handle ? <a href={`https://github.com/${c.handle}`} target="_blank" rel="noopener" className={`${cls} transition-colors duration-150 hover:border-ink/40`}>{inner}</a> : <span className={cls}>{inner}</span>}</li>;
              })}
            </Shuffled>
            <p className="font-mono text-[13px] text-ink-3">the people who&apos;ve shaped the club over the years</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
