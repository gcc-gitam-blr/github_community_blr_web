"use client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, ScreenFullIcon } from "@primer/octicons-react";
import { Coin, Wordmark } from "./Bits";
import { qr } from "@/lib/epoch/store";
import { EPOCH } from "@/lib/epoch/config";
import { useClientValue } from "@/lib/useClientValue";
import type { Booth } from "@/lib/epoch/types";

/* A booth's QR for a phone or tablet propped up at the booth: one screen, no scrolling, big enough to scan
   from arm's length. It asks the browser to keep the screen awake while it's open. */

export type Wake = "on" | "off" | "none";
export function useWakeLock(): [Wake, () => void] {
  const supported = useClientValue(() => typeof navigator !== "undefined" && "wakeLock" in navigator, true);
  const [on, setOn] = useState(false); const [n, setN] = useState(0); // n: ask again (a tap, or the tab coming back)
  useEffect(() => {
    if (!supported) return;
    let lock: WakeLockSentinel | null = null, live = true;
    navigator.wakeLock.request("screen").then((l) => { if (!live) return void l.release(); lock = l; setOn(true); l.addEventListener("release", () => live && setOn(false)); }).catch(() => setOn(false));
    // the browser drops the lock when the tab is hidden; take it again when it's back
    const back = () => { if (document.visibilityState === "visible") setN((x) => x + 1); };
    document.addEventListener("visibilitychange", back);
    return () => { live = false; document.removeEventListener("visibilitychange", back); void lock?.release(); };
  }, [supported, n]);
  return [!supported ? "none" : on ? "on" : "off", () => setN((x) => x + 1)];
}

export function Kiosk({ booth }: { booth: Booth }) {
  const [wake, retry] = useWakeLock();
  const recharge = booth.kind === "recharge";
  const full = () => { void document.documentElement.requestFullscreen?.().catch(() => {}); };

  return (
    <div className="flex h-dvh flex-col overflow-hidden px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:px-8">
      <header className="flex items-center gap-2 text-[13px] text-mute">
        <Link href="/epoch/admin" className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 hover:text-ink"><ArrowLeftIcon size={16} />Desk</Link>
        <span className="mx-auto flex items-center gap-1.5"><Coin size={20} /><Wordmark className="text-[18px] text-ink" /></span>
        {wake === "off" ? <button onClick={retry} className="rounded-full border border-hair bg-white px-3 py-1.5">Keep screen on</button>
          : <span className="hidden items-center gap-1.5 min-[380px]:flex"><span aria-hidden className={`h-2 w-2 rounded-full ${wake === "on" ? "bg-[#2da44e]" : "bg-hair"}`} />{wake === "on" ? "Screen stays on" : "Turn off auto-lock"}</span>}
        <button onClick={full} aria-label="Full screen" className="hidden rounded-full p-2 hover:text-ink sm:block"><ScreenFullIcon size={16} /></button>
      </header>

      {/* portrait: QR above the words; landscape (a tablet on its side): side by side */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[3dvh] landscape:flex-row landscape:gap-[5vw]">
        <div role="img" aria-label={`QR code for ${booth.name}`} className="aspect-square w-[min(56dvh,86vw)] rounded-[28px] border border-ink/10 bg-white p-[4%] shadow-[0_24px_50px_-30px_rgba(11,11,15,.45)] landscape:w-[min(76dvh,44vw)]">
          <QRCodeSVG value={qr.booth(booth.id)} size={512} level="M" aria-hidden style={{ width: "100%", height: "100%" }} />
        </div>
        <div className="max-w-[min(92vw,640px)] text-center landscape:text-left">
          <p className="font-mono text-[clamp(12px,1.8dvh,15px)] text-mute">{recharge ? "recharge point · once each" : "booth · per session"}</p>
          <h1 className="mt-1 text-[clamp(30px,6.4dvh,80px)] font-medium leading-[1] tracking-[-0.045em]">{booth.name}</h1>
          <p className="mt-[1.6dvh] flex items-center justify-center gap-3 text-[clamp(30px,7dvh,88px)] font-medium leading-none tracking-[-0.05em] landscape:justify-start">
            <Coin size={56} />{recharge ? `+${booth.coins}` : booth.coins}<span className="text-[0.4em] tracking-normal text-mute">{EPOCH.currency}</span>
          </p>
          <p className="mt-[2dvh] text-[clamp(15px,2.4dvh,22px)] leading-snug text-ink/80">{recharge ? "Win the challenge, then scan this with your Epoch wallet." : "Open your Epoch wallet, tap Scan and point it here."}</p>
        </div>
      </div>
    </div>
  );
}
