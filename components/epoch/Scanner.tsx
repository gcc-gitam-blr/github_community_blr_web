"use client";
import { useEffect, useRef, useState } from "react";
import { mono } from "./Bits";

/** Camera QR scanner (html5-qrcode, loaded on demand). Calls onCode once per scan. */
export function Scanner({ onCode, paused }: { onCode: (text: string) => void; paused?: boolean }) {
  const [err, setErr] = useState(""); const [starting, setStarting] = useState(true);
  const cb = useRef(onCode); cb.current = onCode;
  const pausedRef = useRef(paused); pausedRef.current = paused;

  useEffect(() => {
    let stop: (() => Promise<void>) | undefined; let dead = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (dead) return;
        const q = new Html5Qrcode("epoch-reader", { verbose: false });
        await q.start({ facingMode: "environment" }, { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s }; } },
          (text) => { if (!pausedRef.current) cb.current(text); }, () => {});
        stop = async () => { try { await q.stop(); q.clear(); } catch { /* already stopped */ } };
        if (dead) await stop(); else setStarting(false);
      } catch { setErr("Camera unavailable — allow access, or type the code below."); setStarting(false); }
    })();
    return () => { dead = true; void stop?.(); };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[18px] border-2 border-ink bg-ink">
      <div id="epoch-reader" className="min-h-[300px] [&_video]:w-full" />
      {starting && <p className={`${mono} absolute inset-0 grid place-items-center text-epoch`}>Starting camera…</p>}
      {err && <p className={`${mono} absolute inset-0 grid place-items-center p-6 text-center text-epoch`}>{err}</p>}
      {/* viewfinder corners */}
      {[["left-4 top-4", "border-l-4 border-t-4"], ["right-4 top-4", "border-r-4 border-t-4"], ["left-4 bottom-4", "border-l-4 border-b-4"], ["right-4 bottom-4", "border-r-4 border-b-4"]].map(([p, b]) => <i key={p} className={`pointer-events-none absolute h-8 w-8 border-epoch ${p} ${b}`} />)}
    </div>
  );
}
