"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircleIcon, ImageIcon, UploadIcon } from "@primer/octicons-react";
import gallery from "@/lib/gallery.json";
import { EVENTS, eventSlug } from "@/lib/events";
import { MAX_PER_UPLOAD, SIZES, folderOk, toFolder } from "@/lib/photo-upload";

/* Add photos from your phone or laptop. Each photo is resized here, in the browser, to three WebP sizes, which also
   strips the camera and location data; only those small, clean files are sent. Then they're added to the gallery
   folder you pick in one commit, and the site updates itself in a minute or two. */
type Item = { file: File; url: string; caption: string };
type Ready = { s: "checking" } | { s: "login" } | { s: "access" } | { s: "ok" };

const toBase64 = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(b); });
async function resize(file: File) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); // phones store sideways photos with a "rotate me" note
  const out: Record<string, string> = {}; let w = 0, h = 0;
  for (const { w: max, s } of SIZES) {
    const k = Math.min(1, max / bmp.width), cw = Math.round(bmp.width * k), ch = Math.round(bmp.height * k);
    const c = document.createElement("canvas"); c.width = cw; c.height = ch; c.getContext("2d")!.drawImage(bmp, 0, 0, cw, ch);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.8));
    if (!blob || blob.type !== "image/webp") throw new Error("This browser can't save WebP images. Please use Chrome, Edge or Firefox.");
    out[s] = await toBase64(blob); if (s === "lg") { w = cw; h = ch; }
  }
  bmp.close();
  return { out, w, h };
}

export function PhotoUploader() {
  const [ready, setReady] = useState<Ready>({ s: "checking" });
  const [folder, setFolder] = useState(""); const [title, setTitle] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<{ k: "busy" | "ok" | "err"; t: string } | null>(null);
  useEffect(() => { fetch("/api/photos/blob").then((r) => r.json()).then((r) => setReady(r.ok ? { s: "ok" } : { s: r.reason === "access" ? "access" : "login" })).catch(() => setReady({ s: "login" })); }, []);

  const folders = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of EVENTS) m.set(eventSlug(e), e.title);
    for (const p of gallery as { event: string; eventTitle: string }[]) if (!m.has(p.event)) m.set(p.event, p.eventTitle);
    return [...m.entries()];
  }, []);
  const pick = (v: string) => { setFolder(v); setTitle(folders.find(([f]) => f === v)?.[1] ?? ""); };
  const add = (files: FileList | null) => setItems((xs) => [...xs, ...[...(files ?? [])].filter((f) => f.type.startsWith("image/")).map((file) => ({ file, url: URL.createObjectURL(file), caption: "" }))].slice(0, MAX_PER_UPLOAD));

  const upload = async () => {
    const f = toFolder(folder);
    if (!folderOk(f)) { setStatus({ k: "err", t: "Pick an event or type a folder name first." }); return; }
    try {
      const photos = [];
      for (const [i, it] of items.entries()) {
        setStatus({ k: "busy", t: `Preparing photo ${i + 1} of ${items.length}…` });
        const { out, w, h } = await resize(it.file);
        const r = await fetch("/api/photos/blob", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(out) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error);
        photos.push({ shas: j.shas, w, h, caption: it.caption });
      }
      setStatus({ k: "busy", t: "Adding them to the gallery…" });
      const r = await fetch("/api/photos/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder: f, title: title || f, photos }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      items.forEach((it) => URL.revokeObjectURL(it.url)); setItems([]);
      setStatus({ k: "ok", t: `${j.added} photo${j.added === 1 ? "" : "s"} added to “${f}”. The site updates itself in a minute or two.` });
    } catch (e) { setStatus({ k: "err", t: (e as Error).message || "Something went wrong. Try again." }); }
  };

  if (ready.s === "checking") return <div className="h-40" aria-busy="true" />;
  if (ready.s !== "ok") return (
    <p className="mt-8 rounded-[16px] border-2 border-dashed border-line p-6 text-[17px] text-ink-2">
      {ready.s === "login" ? <>First <Link href="/keystatic" className="font-semibold text-link hover:underline">log in to the content editor</Link> with GitHub (same login), then come back to this page.</> : <>Your GitHub login can&apos;t change the club&apos;s repository. Ask a lead to add you as a collaborator.</>}
    </p>
  );

  const busy = status?.k === "busy";
  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 rounded-[16px] border border-line bg-white p-5 sm:grid-cols-2">
        <label className="block text-[15px] font-semibold">Which event or moment?
          <select value={folders.some(([f]) => f === folder) ? folder : ""} onChange={(e) => pick(e.target.value)} className="mt-1.5 block w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px] font-normal">
            <option value="">Pick one…</option>
            {folders.map(([f, t]) => <option key={f} value={f}>{t}</option>)}
          </select>
        </label>
        <label className="block text-[15px] font-semibold">…or a new folder name
          <input value={folder} onChange={(e) => { setFolder(e.target.value); setTitle(e.target.value); }} placeholder="e.g. hackathon-2025" className="mt-1.5 block w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px] font-normal" />
          {folder && !folders.some(([f]) => f === folder) && <span className="mt-1 block font-mono text-[12.5px] font-normal text-ink-3">saved as: {toFolder(folder) || "—"}</span>}
        </label>
      </div>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[16px] border-2 border-dashed border-line p-8 text-center text-ink-2 transition hover:border-ink">
        <UploadIcon size={24} /><span className="text-[17px] font-semibold text-ink">Choose photos</span><span className="text-[14px]">Up to {MAX_PER_UPLOAD} at a time. Location data is removed before anything is sent.</span>
        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it, i) => (
            <li key={it.url} className="overflow-hidden rounded-[12px] border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url} alt="" className="aspect-[4/3] w-full object-cover" />
              <input value={it.caption} onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} placeholder="Caption (optional)" aria-label={`Caption for photo ${i + 1}`} className="block w-full border-t border-line bg-white px-2.5 py-2 text-[13.5px]" />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={upload} disabled={busy || !items.length} className="press inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 font-display font-bold text-white transition-colors duration-150 hover:bg-ink/85 disabled:opacity-50"><ImageIcon size={18} />{busy ? "Working…" : `Add ${items.length || ""} photo${items.length === 1 ? "" : "s"}`}</button>
        {status && <p role="status" className={`inline-flex items-center gap-2 text-[15px] ${status.k === "err" ? "text-[#cf222e]" : status.k === "ok" ? "text-[#1a7f37]" : "text-ink-2"}`}>{status.k === "ok" && <CheckCircleIcon size={16} />}{status.t}</p>}
      </div>
      <p className="text-[14px] text-ink-3">They show in the home gallery, on that event&apos;s recap, and on <Link href="/memories" className="underline">Memories</Link> once you pick the folder for a moment in the editor.</p>
    </div>
  );
}
