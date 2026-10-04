"use client";
import { useSyncExternalStore } from "react";
import { DeviceDesktopIcon, MoonIcon, SunIcon } from "@primer/octicons-react";
import { currentTheme, readChoice, setChoice, subscribeTheme, type ThemeChoice } from "@/lib/theme";

/* The header's light/dark switch: one tap flips it, and the choice is remembered on this device.
   (The server renders the light icon; the real one appears as soon as the page is interactive.) */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "light" as const);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" onClick={() => setChoice(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-black/[.05] hover:text-ink lg:h-9 lg:w-9 ${className}`}>
      {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  );
}

const OPTIONS: { v: ThemeChoice; label: string; Icon: typeof SunIcon }[] = [
  { v: "system", label: "System", Icon: DeviceDesktopIcon }, { v: "light", label: "Light", Icon: SunIcon }, { v: "dark", label: "Dark", Icon: MoonIcon },
];

/** System · Light · Dark, for the footer (always on a dark background) and the phone menu. */
export function ThemeChoices({ tone = "footer" }: { tone?: "footer" | "menu" }) {
  const choice = useSyncExternalStore(subscribeTheme, readChoice, () => "system" as const);
  const on = tone === "footer" ? "bg-[#f0f6fc1a] text-[#f0f6fc]" : "bg-ink text-white";
  const off = tone === "footer" ? "text-[#9da7b3] hover:text-[#f0f6fc]" : "text-ink-2 hover:text-ink";
  return (
    <div role="radiogroup" aria-label="Theme" className={`inline-flex rounded-full border p-0.5 ${tone === "footer" ? "border-[#30363d]" : "border-line"}`}>
      {OPTIONS.map(({ v, label, Icon }) => (
        <button key={v} type="button" role="radio" aria-checked={choice === v} onClick={() => setChoice(v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors ${choice === v ? on : off}`}>
          <Icon size={14} />{label}
        </button>
      ))}
    </div>
  );
}
