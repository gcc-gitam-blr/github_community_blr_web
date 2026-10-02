"use client";
import { useEffect, useState } from "react";
import { XIcon } from "@primer/octicons-react";
import { EpochLink } from "@/components/epoch/EpochLink";
import { EpochCoin } from "@/components/epoch/EpochCoin";

/* Phones only: Epoch lives inside the menu there, so a small pill under the header points to it — until the
   person has opened Epoch once (EpochNav records that) or closes the pill. It tucks away while scrolling down. */
export const EPOCH_SEEN = "club:epoch-seen";
const seen = () => { try { return !!localStorage.getItem(EPOCH_SEEN); } catch { return true; } };
const remember = () => { try { localStorage.setItem(EPOCH_SEEN, "1"); } catch { /* private mode: it just shows again */ } };

export function EpochNudge({ hidden }: { hidden: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (seen()) return;
    const t = setTimeout(() => setShow(true), 900); // after the page has settled, not competing with the hero
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="epoch-nudge pointer-events-auto mx-auto mt-2 w-fit lg:hidden" data-hidden={hidden}>
      <div className="flex items-center gap-1 rounded-full border border-black/10 bg-ink py-1 pl-1 pr-1 text-[13.5px] text-white shadow-[0_12px_28px_-14px_rgba(11,11,15,.6)]">
        <EpochLink className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2">
          <span onClickCapture={remember} className="flex items-center gap-2">
            <EpochCoin size={22} detail={false} />
            <span><b className="font-semibold text-gold">New</b> · Epoch, our December fest</span>
            <span className="font-semibold">Explore →</span>
          </span>
        </EpochLink>
        <button type="button" aria-label="Dismiss" onClick={() => { remember(); setShow(false); }} className="grid h-7 w-7 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"><XIcon size={14} /></button>
      </div>
    </div>
  );
}
