"use client";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { Sticker } from "@/components/ui/Sticker";
import { Coin, btnInk } from "./Bits";
import { Hero } from "./home/Hero";
import { TicketPanel } from "./home/TicketPanel";
import { BoothSection } from "./home/BoothSection";
import { PlanList } from "./home/PlanList";
import { Sponsors } from "./home/Sponsors";
import { useEpoch } from "./EpochProvider";
import { EpochInterest } from "@/components/site/EpochInterest";
import { BOOTH_COUNT, EPOCH, REWARDS } from "@/lib/epoch/config";

const wrap = "mx-auto w-full max-w-[1120px] px-6 md:px-10";
const h2 = "text-[clamp(38px,5.6vw,72px)] font-medium leading-[1.02] tracking-[-0.045em]";
const Rule = () => <div className={wrap}><hr className="border-ink/10" /></div>;

export function EpochHome() {
  const { me } = useEpoch();
  return (
    <>
      <Hero />
      <section id="dates" aria-labelledby="dates-h" className="pb-[clamp(56px,8vw,96px)]">
        <div className={`${wrap} grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]`}>
          <div><h2 id="dates-h" className="text-[clamp(30px,4vw,48px)] font-medium leading-[1.05] tracking-[-0.04em]">{EPOCH.startsAt ? "The dates are out." : "Dates aren't tagged yet."}</h2><p className="mt-3 max-w-[44ch] text-[17px] leading-snug text-mute">{EPOCH.startsAt ? "Get your ticket now and your coins are waiting at the desk." : "Leave your email and we'll tell you the day they're announced, so you can plan around exams."}</p></div>
          <EpochInterest />
        </div>
      </section>
      <Rule />
      <TicketPanel />
      <Rule />

      <section id="booths" className="py-[clamp(72px,10vw,140px)]">
        <div className={wrap}>
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className={h2}>{BOOTH_COUNT} places<br />to spend it.</h2>
            <Link href="/epoch/booths" className="text-[16px] text-mute underline underline-offset-4 hover:text-ink">All booths on one page →</Link>
          </Reveal>
          <BoothSection />
        </div>
      </section>

      <Rule />
      <section id="plan" className="py-[clamp(72px,10vw,140px)]">
        <div className={wrap}>
          <Reveal className="mb-10 flex items-end justify-between gap-6">
            <h2 className={h2}>The plan.</h2>
            <Sticker name="list" size={110} tilt={8} className="hidden sm:block" alt="" />
          </Reveal>
          <PlanList />
        </div>
      </section>

      <Rule />
      <section className="py-[clamp(72px,10vw,130px)]">
        <div className={wrap}>
          <Reveal className="mb-10 flex items-end justify-between gap-6">
            <h2 className={h2}>Merch, in coins.</h2>
            <Sticker name="shop" size={110} tilt={-6} className="hidden sm:block" alt="" />
          </Reveal>
          <ul className="grid gap-3 sm:grid-cols-3">
            {REWARDS.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 rounded-[18px] border border-ink/10 bg-white p-5">
                <p className="text-[19px] font-medium tracking-[-0.02em]">{r.name}</p>
                <p className="flex items-center gap-1.5 font-mono text-[14px] font-bold"><Coin size={18} />{r.cost}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Sponsors />

      <section className="relative overflow-hidden bg-ink py-[clamp(80px,11vw,150px)] text-white">
        <div className={`${wrap} relative flex flex-col items-start gap-9`}>
          <Reveal><h2 className="text-[clamp(44px,7.4vw,108px)] font-medium leading-[0.95] tracking-[-0.055em] text-white">See you at<br />Epoch.</h2></Reveal>
          <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={`${btnInk} !bg-[#ffc933] !text-ink hover:!bg-[#ffe28f]`}>{me ? "Open my wallet" : "Get your ticket"}</Link>
          <div aria-hidden className="pointer-events-none absolute -bottom-6 right-4 hidden gap-2 md:flex">
            <Sticker name="skate" size={130} tilt={-10} /><Sticker name="adventure" size={120} tilt={8} className="mt-8" /><Sticker name="cherry" size={115} tilt={-4} />
          </div>
        </div>
      </section>
    </>
  );
}
