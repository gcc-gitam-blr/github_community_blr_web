import { CertQR } from "@/components/site/CertActions";
import { ClubMark } from "@/components/ui/ClubMark";
import { NodeIcon } from "@/components/ui/GitGraph";
import { Sticker } from "@/components/ui/Sticker";
import { CLUB, commitHash } from "@/lib/config";
import { certKind, certTheme } from "@/lib/certificates";
import { eventDate, eventTag, type ClubEvent } from "@/lib/events";

/* The certificate itself: a signed release in the club's history. The coloured spine, the shape and the sticker come
   from the event (so every event's certificate looks its own), and the git log line under the name is the record.
   Prints as one A4 landscape page (see .cert in globals.css). Light on paper whatever the site's theme. */
export function Certificate({ name, handle, event, eventKey, issued, number, url }: { name: string; handle: string | null; event?: ClubEvent; eventKey: string; issued: string; number: string; url: string }) {
  const t = certTheme(event), kind = certKind(event);
  const hash = commitHash((event?.title ?? eventKey) + (event?.date ?? eventKey));
  const tag = event ? eventTag(event) : eventKey;
  const shape = (event?.shape ?? "diamond") as "diamond" | "square" | "ring" | "triangle";
  const color = (event?.color ?? "green") as "blue" | "purple" | "mint" | "green";
  return (
    <article className="cert relative mx-auto grid aspect-[297/210] w-full max-w-[1040px] grid-cols-[22%_1fr] overflow-hidden border-2 border-ink bg-[#fffdf8] shadow-[0_30px_80px_-30px_rgba(11,11,15,.35)] print:shadow-none" style={{ color: "#0b0b0f" }}>
      {/* the spine: the event's colour, its shape on the club's branch, and its release tag */}
      <div className="relative flex flex-col items-center justify-between border-r-2 border-ink px-[6%] py-[9%]" style={{ background: t.tint }}>
        <div className="flex flex-col items-center gap-[6%] text-center">
          <ClubMark size={40} className="max-sm:!h-6 max-sm:!w-6" />
          <p className="font-display text-[clamp(9px,1.25vw,14px)] font-black leading-tight">GitHub Community<br />Club <span className="rounded bg-[#3fc84e] px-1">BLR</span></p>
        </div>
        <svg aria-hidden viewBox="0 0 60 220" className="w-[48%] flex-none">
          <path d="M30 0V220" stroke="#0b0b0f" strokeWidth="5" />
          <path d="M30 40C30 70 6 70 6 100V120C6 150 30 150 30 180" stroke="#0b0b0f" strokeWidth="5" fill="none" strokeDasharray="0" />
          <circle cx="30" cy="40" r="7" fill="#fffdf8" stroke="#0b0b0f" strokeWidth="4" />
          <circle cx="6" cy="110" r="6" fill={t.deep} stroke="#0b0b0f" strokeWidth="3" />
          <circle cx="30" cy="200" r="7" fill="#0b0b0f" />
        </svg>
        <div className="-my-[30%] scale-[1.15]"><NodeIcon shape={shape} color={color} size={64} /></div>
        <div className="text-center font-mono leading-snug">
          <p className="text-[clamp(8px,1.1vw,13px)] font-bold">{tag}</p>
          <p className="text-[clamp(7px,0.9vw,11px)]" style={{ color: t.deep }}>commit {hash}</p>
        </div>
      </div>

      <div className="relative flex flex-col px-[6.5%] pb-[4.5%] pt-[6%]">
        <Sticker name={kind.sticker} size={120} tilt={8} className="pointer-events-none absolute right-[4%] top-[5%] !h-[18%] !w-auto" alt="" />
        <p className="font-mono text-[clamp(8px,1.15vw,13.5px)] uppercase tracking-[0.22em]" style={{ color: t.deep }}>Certificate of participation</p>
        {event?.type && <p className="mt-[1.4%] w-fit rounded-full border-[1.5px] border-ink px-[1.4%] py-[0.3%] font-mono text-[clamp(7px,0.95vw,11.5px)] font-bold" style={{ background: t.soft }}>{event.type}</p>}

        <div className="my-auto pt-[2%]">
          <p className="text-[clamp(10px,1.45vw,17px)] text-[#3a3d44]">This certifies that</p>
          <h1 className="mt-[0.6%] max-w-[88%] font-display text-[clamp(26px,5.4vw,62px)] font-black leading-[1.02] tracking-[-0.03em]">{name}</h1>
          <p className="mt-[2%] max-w-[86%] text-[clamp(10px,1.55vw,18px)] leading-relaxed text-[#3a3d44]">
            took part in <b className="font-display font-black text-[#0b0b0f]">{event?.title ?? eventKey}</b>{event ? <>, {kind.line} held {event.dateLabel ? "in" : "on"} {eventDate(event)} at {event.where}.</> : "."}
          </p>
          {/* the record, as git would print it */}
          <p className="mt-[2.4%] w-fit max-w-full overflow-hidden rounded-md border-[1.5px] border-ink bg-white px-[1.6%] py-[0.8%] font-mono text-[clamp(7px,1vw,12px)] leading-relaxed">
            <span style={{ color: t.deep }}>commit {hash}</span> (tag: {tag})<br />
            Author: {name}{handle ? <> &lt;@{handle}&gt;</> : null}<br />
            <span className="font-bold">✓ merged into main</span>
          </p>
        </div>

        <footer className="grid grid-cols-[1fr_auto_auto] items-end gap-[4%] pt-[3%]">
          <div className="text-[clamp(7px,1vw,12px)] leading-relaxed text-[#3a3d44]">
            <p>Issued {issued}</p>
            <p className="font-mono">No. {number}</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-1 w-[clamp(90px,16vw,180px)] border-t-2 border-ink" />
            {/* the club issues it: the university is where the club is, not the issuer */}
            <p className="text-[clamp(6px,0.8vw,10px)] uppercase tracking-[0.12em] text-[#57606a]">Issued by</p>
            <p className="text-[clamp(7px,1vw,12px)] font-semibold">{CLUB.name}</p>
            <p className="text-[clamp(6px,0.8vw,10px)] text-[#57606a]">A student club at {CLUB.university}</p>
          </div>
          <div className="flex items-end gap-2">
            <p className="hidden text-right text-[clamp(6px,0.8vw,10.5px)] leading-snug text-[#57606a] sm:block">Scan to<br />verify</p>
            <div className="rounded border-[1.5px] border-ink bg-white p-1 [&_svg]:h-auto [&_svg]:w-[clamp(44px,7.5vw,88px)]"><CertQR url={url} /></div>
          </div>
        </footer>
        <p className="mt-[1.6%] text-[clamp(6px,0.75vw,9.5px)] text-[#57606a]">A student-run community. Not issued by or affiliated with GitHub, Inc.</p>
      </div>
    </article>
  );
}
