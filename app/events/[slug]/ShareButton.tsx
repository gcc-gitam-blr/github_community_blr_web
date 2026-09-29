"use client";
import { useState } from "react";
import { CheckIcon, CopyIcon, ShareIcon } from "@primer/octicons-react";
import { useClientValue } from "@/lib/useClientValue";

/* Native share sheet on phones; copy-link everywhere else. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = useClientValue(() => "share" in navigator, false);
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch { /* dismissed — fall through to copy */ } }
    await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-soft px-3 py-1.5 text-[13px] font-semibold transition hover:border-ink">
      {copied ? <><CheckIcon size={14} />Link copied</> : <>{canShare ? <ShareIcon size={14} /> : <CopyIcon size={14} />}Share</>}
    </button>
  );
}
