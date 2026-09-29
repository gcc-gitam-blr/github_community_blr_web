import { Reveal } from "@/components/ui/Reveal";
import { Sticker } from "@/components/ui/Sticker";
import { EpochCoin } from "../EpochCoin";
import { EPOCH, RECHARGE_POINTS, STARTER_COINS } from "@/lib/epoch/config";

/* How the economy works, told with the thing you actually hold: a paper ticket whose stub is your coins. */
const RULES = [
  ["Your ticket is your wallet", `Pay ₹${EPOCH.ticketPriceINR} and show your QR at the registration desk. They verify it and ${STARTER_COINS} coins (1 ₹ = ${EPOCH.coinsPerINR}) land in your profile — once.`],
  ["Spend at the booths", "Every booth has a price per session — VR is 40. Merch is paid in coins too, so nobody needs cash on the day."],
  ["Recharge, once each", `Running low? Win a quick game at a recharge point for +${RECHARGE_POINTS[0].coins}. There are ${RECHARGE_POINTS.length}, and each works once per person.`],
];

function Ticket() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] -rotate-2 drop-shadow-[0_22px_30px_rgba(60,40,0,.22)]">
      <div className="flex overflow-hidden rounded-[14px] bg-[#fffaf0] [mask-image:radial-gradient(circle_12px_at_72%_0,transparent_11.5px,#000_12px),radial-gradient(circle_12px_at_72%_100%,transparent_11.5px,#000_12px)] [mask-composite:intersect] [-webkit-mask-composite:source-in]">
        {/* main part */}
        <div className="relative w-[72%] border-r-2 border-dashed border-[#d9cfb8] p-6 sm:p-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a7a55]">Admit one · two days</p>
          <p className="mt-3 font-epoch text-[44px] font-medium lowercase leading-none tracking-[-0.06em] sm:text-[56px]">{EPOCH.name}<span className="text-[#c98a00]">_{EPOCH.edition}</span></p>
          <p className="mt-2 text-[14px] text-[#6b5f45]">GitHub Community Club · {EPOCH.org}</p>
          <div className="mt-6 flex items-end justify-between gap-3">
            <div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8a7a55]">Price</p><p className="font-epoch text-[34px] font-medium leading-none">₹{EPOCH.ticketPriceINR}</p></div>
            {/* barcode */}
            <svg viewBox="0 0 120 34" className="h-9 w-28 text-[#3b3423]" aria-hidden>{Array.from({ length: 34 }, (_, i) => <rect key={i} x={i * 3.5} width={[1, 2, 1, 3, 1, 1, 2][i % 7]} height="34" fill="currentColor" />)}</svg>
          </div>
        </div>
        {/* the stub: what the ticket becomes */}
        <div className="flex w-[28%] flex-col items-center justify-center gap-2 bg-[#fff3cf] p-3 text-center">
          <EpochCoin size={58} detail={false} />
          <p className="font-epoch text-[26px] font-medium leading-none tracking-[-0.04em]">{STARTER_COINS}</p>
          <p className="font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-[#8a7a55]">Epoch coins<br />at the desk</p>
        </div>
      </div>
      <Sticker name="swag" size={92} tilt={14} className="absolute -right-1 -top-9" alt="" />
    </div>
  );
}

export function TicketPanel() {
  return (
    <section id="ticket" className="overflow-x-clip py-[clamp(72px,10vw,140px)]">
      <div className="mx-auto grid w-full max-w-[1120px] items-center gap-14 px-6 md:px-10 lg:grid-cols-[1fr_1fr]">
        <Reveal><Ticket /></Reveal>
        <div>
          <Reveal><h2 className="text-[clamp(38px,5.4vw,68px)] font-medium leading-[1.02] tracking-[-0.045em]">₹{EPOCH.ticketPriceINR} in.<br />{STARTER_COINS} coins out.</h2></Reveal>
          <ol className="mt-10 border-t border-ink/10">
            {RULES.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 0.08} className="grid grid-cols-[40px_1fr] border-b border-ink/10 py-6">
                <span className="pt-1 font-mono text-[14px] text-mute">0{i + 1}</span>
                <div><h3 className="text-[23px] leading-tight">{t}</h3><p className="mt-1.5 text-[16.5px] leading-snug text-mute">{d}</p></div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
