"use client";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { Coin } from "./Bits";
import { Hero } from "./home/Hero";
import { EconomyPanel } from "./home/EconomyPanel";
import { BoothSection } from "./home/BoothSection";
import { PlanList } from "./home/PlanList";
import { useEpoch } from "./EpochProvider";
import { BOOTH_COUNT, REWARDS } from "@/lib/epoch/config";

const wrap = "mx-auto w-full max-w-[1120px] px-6 md:px-10";
const h2 = "text-[clamp(38px,6vw,76px)] font-medium leading-[1.02] tracking-[-0.045em]";
const Dotted = () => <div className={wrap}><hr className="border-0 border-t-2 border-dotted border-ink/25" /></div>;

export function EpochHome() {
  const { me } = useEpoch();
  return (
    <>
      <Hero />
      <EconomyPanel />

      <section id="booths" className="py-[clamp(80px,11vw,150px)]">
        <div className={wrap}>
          <Reveal className="mb-14"><h2 className={h2}>{BOOTH_COUNT} places<br />to spend it.</h2></Reveal>
          <BoothSection />
        </div>
      </section>

      <Dotted />
      <section id="plan" className="py-[clamp(80px,11vw,150px)]">
        <div className={wrap}>
          <Reveal className="mb-12"><h2 className={h2}>The plan.</h2></Reveal>
          <PlanList />
        </div>
      </section>

      <Dotted />
      <section className="py-[clamp(70px,10vw,130px)]">
        <div className={wrap}>
          <Reveal className="mb-10"><h2 className={h2}>Merch, in coins.</h2></Reveal>
          <ul className="grid gap-6 sm:grid-cols-3">
            {REWARDS.map((r) => (
              <li key={r.id} className="rounded-[28px] border border-white/80 bg-white/55 p-6 backdrop-blur-xl"><p className="text-[21px] font-medium tracking-[-0.02em]">{r.name}</p><p className="mt-1 flex items-center gap-2 text-[17px] text-mute"><Coin size={20} />{r.cost}</p></li>
            ))}
          </ul>
        </div>
      </section>

      {/* Teampaper's giant dotted pill */}
      <section className="pb-[clamp(90px,12vw,170px)] pt-10">
        <div className={wrap}>
          <Link href={me ? "/epoch/wallet" : "/epoch/register"} className="group flex h-[clamp(130px,19vw,260px)] items-center justify-center rounded-full border-2 border-dotted border-ink/40 text-[clamp(38px,7.4vw,112px)] font-medium tracking-[-0.055em] transition duration-300 hover:border-ink hover:bg-ink hover:text-white">
            {me ? "Open my wallet" : "Get your ticket"}<span className="ml-[.25em] transition-transform duration-300 group-hover:translate-x-3">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
