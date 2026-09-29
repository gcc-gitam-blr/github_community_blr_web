"use client";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { Coin, btnGold, mono } from "./Bits";
import { HomeHero } from "./home/HomeHero";
import { CoinFlow } from "./home/CoinFlow";
import { BoothExplorer } from "./home/BoothExplorer";
import { PlanTimeline } from "./home/PlanTimeline";
import { useEpoch } from "./EpochProvider";
import { EPOCH, REWARDS, STARTER_COINS } from "@/lib/epoch/config";

const wrap = "mx-auto w-full max-w-[1280px] px-5 md:px-10";

function Head({ k, title, children }: { k: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Reveal className="mb-12 max-w-[820px]">
      <p className={`${mono} text-gold`}>{k}</p>
      <h2 className="mt-4 text-[clamp(38px,6vw,76px)]">{title}</h2>
      {children && <p className="mt-5 max-w-[60ch] text-lg text-fog">{children}</p>}
    </Reveal>
  );
}

const RULES = [
  ["01", "Ticket → coins", `Your ticket (₹${EPOCH.ticketPriceINR} as the working price) converts at 1 ₹ = ${EPOCH.coinsPerINR} coins. That's ${STARTER_COINS} ${EPOCH.currency}, credited to your profile once the desk verifies it.`],
  ["02", "Spend anywhere", "Booths, games and experiences each have a coin price — VR is 40 a session. Merch is buyable with coins too, so no cash at the stalls."],
  ["03", "Recharge — once", `Ran low? Beat a mini-game at a recharge point for ${20} coins. Every point works once per person, so plan your route.`],
  ["04", "Everything visible", "Your website profile shows balance, full transaction history, and how many recharge points you still have left. Updates in real time."],
];

export function EpochHome() {
  const { me } = useEpoch();
  return (
    <>
      <HomeHero />

      <section className="py-[clamp(70px,10vw,140px)]" id="economy">
        <div className={wrap}>
          <Head k="// the economy" title={<>One currency.<br />Twenty-one places to use it.</>}>
            No cash at the booths. Coins flow in from your ticket and from recharge points, and out to whatever you fancy.
          </Head>
          <Reveal className="rounded-[2rem] border border-edge bg-night-2/50 p-4 sm:p-8"><CoinFlow /></Reveal>
          <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {RULES.map(([n, t, d], i) => (
              <Reveal as="li" key={n} delay={i * 0.07} className="rounded-3xl border border-edge bg-night-2/70 p-7">
                <span className={`${mono} text-gold`}>{n}</span>
                <h3 className="mb-3 mt-8 text-2xl">{t}</h3><p className="text-[15px] text-fog">{d}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-edge py-[clamp(70px,10vw,140px)]" id="booths">
        <div className={wrap}>
          <Head k="// booths" title={<>Find your <span className="text-gold">kind of chaos</span>.</>}>VR, escape rooms, human snake &amp; ladder, a 3D printer, retro arcades — plus five recharge points to keep you in the game.</Head>
          <BoothExplorer compact />
        </div>
      </section>

      <section className="border-t border-edge py-[clamp(70px,10vw,140px)]" id="plan">
        <div className={wrap}>
          <Head k="// plan of action" title={<>Two days, <br />committed to history.</>}>Workshops in the morning, competitions running alongside, booths from 2 PM, and a closing ceremony on the second evening.</Head>
          <PlanTimeline />
        </div>
      </section>

      <section className="border-t border-edge py-[clamp(70px,10vw,140px)]">
        <div className={wrap}>
          <Head k="// merchandise stall" title={<>Wear your <span className="text-gold">commits</span>.</>}>Event-branded tees and hoodies, Octocat stickers — all payable in coins.</Head>
          <ul className="grid gap-3 md:grid-cols-3">
            {REWARDS.map((r, i) => (
              <Reveal as="li" key={r.id} delay={i * 0.08} className="flex min-h-[260px] flex-col justify-between rounded-3xl border border-edge bg-gradient-to-br from-gold/15 to-transparent p-7">
                <span className={`${mono} flex items-center gap-2 font-bold text-gold`}><Coin size={18} />{r.cost}</span>
                <div><h3 className="text-3xl">{r.name}</h3><p className="mt-2 text-fog">{r.blurb}</p></div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-edge bg-gold py-[clamp(80px,12vw,160px)] text-night">
        <div className={`${wrap} flex flex-col items-start gap-8`}>
          <Reveal><h2 className="text-[clamp(44px,8vw,120px)] leading-[.92] text-night">Second zero<br />is coming.</h2></Reveal>
          <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={`${btnGold.replace("bg-gold", "bg-night").replace("text-night", "text-gold").replace("hover:bg-gold-soft", "hover:bg-night-3")}`}>{me ? "Open my wallet" : "Get your ticket"} →</Link>
        </div>
      </section>
    </>
  );
}
