"use client";
import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, useReducedMotion } from "motion/react";
import { Coin, Wordmark } from "./Bits";
import { LinkState } from "./Lists";
import { useWakeLock } from "./Kiosk";
import { useHappening } from "./HappeningNow";
import { activeAnnouncement } from "@/components/site/Announcement";
import { EPOCH } from "@/lib/epoch/config";
import { istTime, laterDay, untilLabel } from "@/lib/epoch/happening";
import { useLiveLeaderboard } from "@/lib/epoch/live";
import { SITE_URL } from "@/lib/site";

/* /epoch/screen: for a projector or TV at the venue. One 16:9 frame, no scrolling, nothing that needs a mouse;
   type is sized from the screen's height so it reads from the back of a hall. It keeps the screen awake, follows
   the live leaderboard (reconnecting on its own), and reloads itself every few hours to pick up a new deploy. */
const RELOAD = 4 * 36e5;
const today = (now: number) => new Date(now + 330 * 60_000).toISOString().slice(0, 10); // the date in India

export function BigScreen() {
  const { rows, link, updatedAt } = useLiveLeaderboard(8);
  const { h, now } = useHappening(10_000);
  const still = useReducedMotion();
  useWakeLock();
  useEffect(() => { const t = setTimeout(() => { if (navigator.onLine) location.reload(); }, RELOAD); return () => clearTimeout(t); }, []);
  const notice = now ? activeAnnouncement(today(now)) : undefined;

  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-x-[3vw] gap-y-[3vh] overflow-hidden bg-[#0b0b0f] px-[3.5vw] py-[4vh] text-white">
      <header className="col-span-2 flex items-center gap-[1.2vw]">
        <Coin size={44} /><Wordmark className="text-[4.4vh] text-white" />
        <span className="text-[3vh] text-white/50">leaderboard</span>
        <span className="ml-auto flex items-center gap-[2vw] text-[2.4vh] text-white/60">
          <LinkState link={link} updatedAt={updatedAt} className="!text-[2vh] !text-white/60" />
          {now > 0 && <span className="tabular-nums text-white">{istTime(now)}</span>}
        </span>
      </header>

      <section aria-label="Top earners" className="min-h-0">
        {rows?.length === 0 && <p className="text-[4vh] leading-tight text-white/70">Nobody has earned coins yet.<br />Win a recharge challenge to be first.</p>}
        <ol className="flex h-full flex-col">
          {rows?.map((r, i) => (
            <motion.li key={r.id} layout={!still} transition={{ type: "spring", stiffness: 380, damping: 36 }} className="flex min-h-0 flex-1 items-center gap-[1.6vw] border-b border-white/10 last:border-0">
              <span className={`w-[3.2vw] text-[3.4vh] tabular-nums ${i < 3 ? "text-[#ffc933]" : "text-white/60"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[4.4vh] font-medium tracking-[-0.03em]">{r.name}<span className="ml-[1vw] text-[2.4vh] font-normal text-white/60">@{r.handle}</span></span>
              {r.gained > 0 && <span key={`${r.id}-${r.earned}`} className="animate-[fade-out_6s_ease-out_forwards] rounded-full bg-[#1a7f37] px-[0.8vw] py-[0.3vh] text-[2.4vh] tabular-nums motion-reduce:animate-none">+{r.gained}</span>}
              <span className="flex items-center gap-[0.6vw] text-[4.4vh] font-medium tabular-nums"><Coin size={34} />{r.earned}</span>
            </motion.li>
          ))}
        </ol>
      </section>

      <aside className="flex min-h-0 flex-col gap-[2.5vh]">
        <div aria-live="polite" className="rounded-[2vh] border border-white/10 bg-white/[0.06] p-[2.6vh]">
          {h.phase === "on" ? (<>
            <p className="flex items-center gap-[0.6vw] text-[2.2vh] text-white/60"><span className="h-[1.2vh] w-[1.2vh] animate-pulse rounded-full bg-[#3fb950] motion-reduce:animate-none" aria-hidden />Happening now · Day {h.day}</p>
            {h.now.length ? h.now.slice(0, 3).map((s) => <p key={s.start + s.title} className="mt-[1vh] text-[3.4vh] font-medium leading-tight tracking-[-0.02em]">{s.title} <span className="text-[2.2vh] font-normal text-white/50">until {istTime(s.end)}</span></p>)
              : <p className="mt-[1vh] text-[3.4vh] text-white/70">A short break.</p>}
            {h.next[0] && <p className="mt-[1.6vh] text-[2.4vh] text-white/60">{laterDay(h.next[0].start, now) ? "Tomorrow" : `Next, ${untilLabel(h.next[0].start - now)}`} · <span className="text-white">{istTime(h.next[0].start)} {h.next[0].title}</span></p>}
          </>) : h.phase === "before" ? (<>
            <p className="text-[2.2vh] text-white/60">Epoch starts {untilLabel(h.startsIn)}</p>
            {h.next[0] && <p className="mt-[1vh] text-[3.4vh] font-medium leading-tight">First up: {istTime(h.next[0].start)} {h.next[0].title}</p>}
          </>) : (<>
            <p className="text-[2.2vh] text-white/60">{EPOCH.dates}</p>
            <p className="mt-[1vh] text-[3.4vh] font-medium leading-tight tracking-[-0.02em]">{EPOCH.tagline}</p>
          </>)}
        </div>

        {notice && <p className="rounded-[2vh] bg-[#ffc933] px-[2.6vh] py-[2vh] text-[2.8vh] font-medium leading-snug text-[#0b0b0f]">{notice.text}</p>}

        <div className="mt-auto flex min-h-0 items-center gap-[2vw] rounded-[2vh] bg-white p-[2.4vh] text-[#0b0b0f]">
          <QRCodeSVG value={`${SITE_URL}/epoch/register`} size={512} marginSize={0} className="aspect-square h-[22vh] w-auto shrink-0" role="img" aria-label="QR code: get your Epoch wallet" />
          <p className="text-[3vh] font-medium leading-tight tracking-[-0.02em]">Scan to get your wallet.<span className="mt-[1vh] block text-[2vh] font-normal text-black/60">Pay at the desk, collect {EPOCH.starterCoins} coins.</span></p>
        </div>
      </aside>

      <footer className="col-span-2 flex items-center justify-between text-[2vh] text-white/60">
        <span>Spend at the booths · earn at recharge points · spending never lowers your rank</span>
        <span>{SITE_URL.replace(/^https?:\/\//, "")}/epoch</span>
      </footer>
    </div>
  );
}
