import Link from "next/link";
import { Sticker, type StickerName } from "@/components/ui/Sticker";
import { PrintButton } from "./PrintButton";
import { CLUB } from "@/lib/config";
import { SITE_URL } from "@/lib/site";
import { BOOTHS, CONTACTS, EPOCH, RECHARGE_POINTS, STARTER_COINS } from "@/lib/epoch/config";
import { REVERSE_WINDOW_MIN, SPEND_COOLDOWN_S } from "@/lib/epoch/rules";

/* The printable guides: one for attendees, one for organisers. Each fits one A4 page when printed
   (see .guide in globals.css) and reads as a normal page on a phone. Every number comes from the real settings. */

type Part = { t: string; body: React.ReactNode };
const vr = BOOTHS.find((b) => b.id === "vr");
const price = EPOCH.ticketPriceINR ? `₹${EPOCH.ticketPriceINR}` : null;
const C = EPOCH.currency;

function GuidePage({ kicker, title, sub, sticker, other, parts, path }: { kicker: string; title: string; sub: string; sticker: StickerName; other: { href: string; label: string }; parts: Part[]; path: string }) {
  return (
    <article className="guide mx-auto w-full max-w-[1040px] px-5 pb-20 pt-28 md:px-10 md:pt-36">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-ink/15 pb-6">
        <div className="min-w-0">
          <p className="font-mono text-[13px] text-mute">{kicker}</p>
          <h1 className="mt-2 text-[clamp(40px,7vw,80px)] font-medium leading-[0.98] tracking-[-0.05em]">{title}</h1>
          <p className="mt-3 max-w-[56ch] text-[17px] text-mute">{sub}</p>
        </div>
        <div className="flex items-end gap-4">
          <div className="no-print flex flex-col items-start gap-2"><PrintButton>Print this page</PrintButton><Link href={other.href} className="px-1 text-[14px] text-mute underline underline-offset-2 hover:text-ink">{other.label}</Link></div>
          <Sticker name={sticker} size={96} tilt={6} className="hidden sm:block print:hidden" alt="" />
        </div>
      </header>
      <ol className="mt-2 grid gap-x-10 md:grid-cols-2 print:grid-cols-2">
        {parts.map((p, i) => (
          <li key={p.t} className="break-inside-avoid border-b border-ink/10 py-5">
            <h2 className="flex items-baseline gap-3 text-[22px] font-medium leading-tight tracking-[-0.02em]"><span className="font-mono text-[13px] text-mute">{String(i + 1).padStart(2, "0")}</span>{p.t}</h2>
            <div className="guide-body mt-2 space-y-1.5 pl-[34px] text-[16px] leading-snug text-ink/85">{p.body}</div>
          </li>
        ))}
      </ol>
      <p className="mt-6 font-mono text-[12px] text-mute">{SITE_URL.replace(/^https?:\/\//, "")}{path} · {EPOCH.dates} · {EPOCH.venue}</p>
    </article>
  );
}

const Ul = ({ items }: { items: React.ReactNode[] }) => <ul className="list-disc space-y-1 pl-4 marker:text-mute">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
const help = CLUB.email ? <>Or email <a className="underline underline-offset-2" href={`mailto:${CLUB.email}`}>{CLUB.email}</a>.</> : null;

export function AttendeeGuide() {
  const parts: Part[] = [
    { t: "Before you come", body: <p>Sign up at <b className="font-medium">/epoch/register</b> with your GitHub account. You get a wallet with your own QR code. Add it to your home screen so it&apos;s one tap away.</p> },
    { t: "At the registration desk", body: <p>Pay for your ticket at the desk{price ? ` (${price})` : ""}; there&apos;s no online payment. They scan your wallet QR and <b className="font-medium">{STARTER_COINS} {C}</b> land in your wallet, once.</p> },
    { t: "Spending coins", body: <p>Each booth costs a few coins per session{vr ? ` (${vr.name.replace(/ Zone$/, "")} is ${vr.coins})` : ""}. Open your wallet, tap <b className="font-medium">Scan</b> and point it at the booth&apos;s QR. Or let the booth&apos;s volunteer scan yours.</p> },
    { t: "Earning more", body: <p>There are {RECHARGE_POINTS.length} recharge points. Win the quick challenge and get +{RECHARGE_POINTS[0]?.coins} {C}, once at each. The leaderboard counts what you earn, so spending never lowers your rank.</p> },
    { t: "Merch", body: <p>Buy tees, hoodies and stickers with coins in the Shop, then show the receipt at the Merchandise Stall to collect it.</p> },
    { t: "Receipts and mistakes", body: <p>Tap any line in your wallet for its receipt: what, where, when, your balance after it and a reference like <span className="font-mono">EPC-00042</span>. Charged twice? Show the receipt to that booth&apos;s volunteer straight away, or at the registration desk.</p> },
    { t: "No signal?", body: <p>Your wallet still opens with your last balance, receipts and QR. It catches up when you&apos;re back online.</p> },
    { t: "Need help?", body: <p>Ask at the registration desk or any volunteer. {help}</p> },
  ];
  return <GuidePage kicker={`${EPOCH.name}_${EPOCH.edition} · attendee guide`} title="How Epoch works." sub={`Everything you need on the day, on one page. ${EPOCH.dates}, ${EPOCH.venue}.`} sticker="welcome" other={{ href: "/epoch/guide/organisers", label: "Organiser guide" }} parts={parts} path="/epoch/guide" />;
}

export function OrganiserGuide() {
  const parts: Part[] = [
    { t: "Know your post", body: <p>Sign in and open the <b className="font-medium">Desk</b>; the top card says what you do today. Volunteers on a booth scan wallets there. Volunteers without a booth check people in. Admins do everything and move people between booths under <b className="font-medium">Who runs what</b>.</p> },
    { t: "Desk check-in", body: <Ul items={[<>Take the payment first{price ? ` (${price})` : ""}, then scan their wallet QR and tap <b className="font-medium">Verify ticket</b>. {STARTER_COINS} {C} go in, once.</>, <>Phone dead or QR lost? Use <b className="font-medium">Find an attendee</b> by name, GitHub username or email.</>]} /> },
    { t: "Cash at the desk", body: <Ul items={["Payment is at the desk only. Never ask anyone to pay online or to a personal account.", "One person holds the cash box each shift. Change comes from the box, never your own pocket.", "At each handover, count the cash together and check it against the check-ins in the audit log.", "Refunds only with an admin there, who also reverses the check-in."]} /> },
    { t: "Scanning at your booth", body: <Ul items={[<>Put the booth&apos;s kiosk or printed QR where people can scan it, or scan their wallet and tap <b className="font-medium">Charge</b>.</>, `A second charge within ${SPEND_COOLDOWN_S} seconds is blocked, so a double tap won't charge twice.`, "Recharge points: pay out only after they pass. Each person gets each point once."]} /> },
    { t: "Reversing a mistake", body: <Ul items={[<>Open the person on the Scan page, find the line and tap <b className="font-medium">Reverse</b>, with a short reason. It adds the opposite line; nothing is deleted.</>, `Volunteers can undo scans at their own booth for ${REVERSE_WINDOW_MIN} minutes. After that, and for check-ins, awards and merch, ask an admin.`, "It can't be done twice, and not if they've already spent the coins. A reversed recharge point stays used."]} /> },
    { t: "The kiosk", body: <p>On the Desk, tap <b className="font-medium">Open my booth&apos;s kiosk</b> on a phone or tablet: a big QR with the name and price. Keep it plugged in; it asks the screen to stay on. Keep the printed QR sheet as a backup.</p> },
    { t: "Who to call", body: CONTACTS.length
      ? <ul className="space-y-1">{CONTACTS.map((c) => <li key={c.name + c.phone}><b className="font-medium">{c.name}</b>{c.role ? ` · ${c.role}` : ""} · <a className="font-mono underline underline-offset-2" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></li>)}</ul>
      : <p>Any admin (they&apos;re listed on the Desk under Who runs what), or the registration desk. {help}</p> },
  ];
  return <GuidePage kicker={`${EPOCH.name}_${EPOCH.edition} · organiser guide`} title="Running Epoch." sub="For volunteers and admins: check-in, cash, scanning, fixing mistakes and the kiosk." sticker="support" other={{ href: "/epoch/guide", label: "Attendee guide" }} parts={parts} path="/epoch/guide/organisers" />;
}
