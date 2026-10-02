"use client";
import { QRCodeSVG } from "qrcode.react";

/* Client bits of the certificate page: the verification QR code, and the print / LinkedIn buttons. */
export function CertQR({ url }: { url: string }) {
  return <QRCodeSVG value={url} size={88} level="M" title="QR code that opens this certificate's verification page" />;
}

export function CertActions({ linkedin }: { linkedin: string }) {
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-3">
      <button onClick={() => window.print()} className="rounded-md bg-ink px-5 py-3 font-display font-bold text-white">Download PDF</button>
      <a href={linkedin} target="_blank" rel="noopener" className="rounded-md bg-[#0a66c2] px-5 py-3 font-display font-bold text-white">Add to LinkedIn ↗</a>
    </div>
  );
}
