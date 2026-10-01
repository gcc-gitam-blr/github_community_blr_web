"use client";
import { useState } from "react";
import { XIcon } from "@primer/octicons-react";
import { CLUB } from "@/lib/config";
import { todayISO, useClientValue } from "@/lib/useClientValue";

/* The newest active announcement, above the header. Dismissing it is remembered in this browser. */
const KEY = "club:dismissed";
const seen = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };

export function activeAnnouncement(today: string) {
  return [...CLUB.announcements].reverse().find((a) => (!a.from || a.from <= today) && (!a.until || a.until >= today));
}

export function Announcement() {
  const today = useClientValue(todayISO, "");
  const [gone, setGone] = useState<string[]>([]);
  const a = today ? activeAnnouncement(today) : undefined;
  const dismissed = useClientValue(() => seen().join(","), "");
  if (!a || gone.includes(a.id) || dismissed.split(",").includes(a.id)) return null;
  const dismiss = () => { setGone((g) => [...g, a.id]); try { localStorage.setItem(KEY, JSON.stringify([...seen(), a.id])); } catch { /* storage blocked */ } };
  return (
    <div role="region" aria-label="Announcement" className={`flex items-center justify-center gap-3 bg-[#1a7f37] px-4 py-2 text-center text-[13.5px] font-medium text-white`}>
      {a.href ? <a href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="underline-offset-4 hover:underline">{a.text} →</a> : <span>{a.text}</span>}
      <button onClick={dismiss} aria-label="Dismiss announcement" className="grid h-6 w-6 flex-none place-items-center rounded-full hover:bg-white/20"><XIcon size={14} /></button>
    </div>
  );
}
