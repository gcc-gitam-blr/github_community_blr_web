"use client";
import { QRCodeSVG } from "qrcode.react";

/* Client bits of the certificate page: the verification QR code, and the print / LinkedIn buttons. */
export function CertQR({ url }: { url: string }) {
  return <QRCodeSVG value={url} size={88} level="M" title="QR code that opens this certificate's verification page" />;
}

/* Print or save it, add it to the LinkedIn profile, or post about it: each share shows the certificate's own picture
   (opengraph-image.tsx), which is how most people will first hear about the club. */
export function CertActions({ linkedin, url, title }: { linkedin: string; url: string; title: string }) {
  const post = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch { /* dismissed: copy instead */ }
    try { await navigator.clipboard.writeText(url); alert("Link copied."); } catch { /* nothing to do */ }
  };
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-3">
      <button onClick={() => window.print()} className="rounded-md bg-ink px-5 py-3 font-display font-bold text-white">Download PDF</button>
      <a href={linkedin} target="_blank" rel="noopener" className="press rounded-md bg-[#0a66c2] px-5 py-3 font-display font-bold text-white">Add to LinkedIn profile ↗</a>
      <a href={post} target="_blank" rel="noopener" className="press rounded-md border-2 border-[#0a66c2] bg-[#e8f1fb] px-5 py-[10px] font-display font-bold text-[#004182]">Post about it ↗</a>
      <button onClick={() => void share()} className="rounded-md border-2 border-ink px-5 py-[10px] font-display font-bold">Share link</button>
    </div>
  );
}
