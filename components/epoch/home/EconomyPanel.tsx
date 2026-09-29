import { Reveal } from "@/components/ui/Reveal";
import { EPOCH, RECHARGE_POINTS, STARTER_COINS } from "@/lib/epoch/config";

const STEPS = [
  ["Your ticket is your wallet", `₹${EPOCH.ticketPriceINR} × ${EPOCH.coinsPerINR}. The desk verifies it and ${STARTER_COINS} ${EPOCH.currency} appear in your profile.`],
  ["Spend at any booth", "VR is 40 a session. Escape rooms, arcades, art and merch all have a coin price. No cash needed."],
  ["Recharge, once", `Beat a mini-game at a recharge point for +${RECHARGE_POINTS[0].coins}. Each point works once per person.`],
];

/* A dark panel in the light page — Sparked's mood: grid lines, light streaks, a glowing orb, gradient type. */
export function EconomyPanel() {
  return (
    <section id="economy" className="px-4 py-8 md:px-8">
      <div className="relative isolate mx-auto max-w-[1280px] overflow-hidden rounded-[44px] bg-[#090a10] p-8 text-white shadow-[0_50px_120px_-50px_rgba(20,10,60,.7)] md:p-16">
        <div aria-hidden className="grid-lines absolute inset-0 -z-10 [mask-image:radial-gradient(70%_80%_at_30%_20%,#000,transparent)]" />
        <div aria-hidden className="absolute -left-24 -top-32 -z-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.35),transparent_65%)] blur-2xl" />
        {["left-[38%] top-0 h-24", "left-[62%] top-16 h-14"].map((c) => <span key={c} aria-hidden className={`absolute -z-10 w-px bg-gradient-to-b from-transparent via-[#7cf0a7] to-transparent ${c}`} />)}
        <div aria-hidden className="absolute -bottom-56 -right-40 -z-10 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_34%_26%,#7a5a00,#1b1400_58%,#0a0a10)] shadow-[0_0_140px_rgba(255,201,51,.16),inset_0_0_0_1px_rgba(255,201,51,.28)]" />

        <Reveal>
          <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[14px] text-white/70">How the economy works</span>
          <h2 className="mt-8 bg-gradient-to-b from-white via-white to-[#ffe28f]/80 bg-clip-text pb-1 text-[clamp(44px,7.2vw,104px)] font-medium leading-[0.98] tracking-[-0.05em] text-transparent">
            ₹{EPOCH.ticketPriceINR} in.<br />{STARTER_COINS} coins out.
          </h2>
        </Reveal>
        <ol className="mt-16 max-w-[720px] border-t border-white/10">
          {STEPS.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 0.08} className="grid grid-cols-[48px_1fr] gap-x-4 border-b border-white/10 py-7">
              <span className="pt-1 text-[15px] text-white/40">0{i + 1}</span>
              <div><h3 className="text-[26px] font-medium leading-tight tracking-[-0.03em] text-white">{t}</h3><p className="mt-2 max-w-[52ch] text-[17px] text-white/60">{d}</p></div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
