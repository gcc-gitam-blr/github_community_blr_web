"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EpochLink } from "@/components/epoch/EpochLink";
import { EpochCoin } from "@/components/epoch/EpochCoin";
import { SocialLinks } from "./SocialLinks";
import { NAV_LINKS } from "./nav-links";

/* The phone menu: a panel that drops from under the header over a dimmed page (dim to focus).
   Opens in 260ms on a drawer curve, closes faster; links cascade in 30ms apart. Esc closes it, focus stays
   inside while it's open and returns to the button after, and the page underneath doesn't scroll.
   It's rendered at the end of <body> so the header's translucent layer can't trap it. */
export function MobileMenu({ href, current, live }: { href: (h: string) => string; current: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(64);
  const button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the portal target only exists in the browser
  useEffect(() => setHost(document.body), []);

  const close = useCallback((focusButton = true) => { setOpen(false); if (focusButton) button.current?.focus(); }, []);
  const toggle = () => {
    if (!open) setTop(Math.round(button.current?.closest("header")?.getBoundingClientRect().bottom ?? 64));
    setOpen(!open);
  };

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement, prev = html.style.overflow; html.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      // keep Tab inside: the menu button plus everything in the panel
      const items = [button.current!, ...panel.current.querySelectorAll<HTMLElement>("a, button")].filter(Boolean);
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at === items.length - 1 ? 0 : at + 1);
      e.preventDefault(); items[next].focus();
    };
    const onWide = () => { if (window.innerWidth >= 1024) close(false); };
    window.addEventListener("keydown", onKey); window.addEventListener("resize", onWide);
    return () => { html.style.overflow = prev; window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onWide); };
  }, [open, close]);

  return (
    <>
      <button ref={button} className="relative h-11 w-11 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="phone-menu" onClick={toggle}>
        <span className={`absolute inset-x-2.5 h-0.5 rounded bg-ink transition-[top,rotate] duration-200 ease-out ${open ? "top-[21px] rotate-45" : "top-4"}`} />
        <span className={`absolute inset-x-2.5 h-0.5 rounded bg-ink transition-[top,rotate] duration-200 ease-out ${open ? "top-[21px] -rotate-45" : "top-[26px]"}`} />
      </button>
      {host && createPortal(
        <div className="phone-menu lg:hidden" data-open={open} style={{ "--top": `${top}px` } as React.CSSProperties}>
          <div className="phone-menu__scrim" onClick={() => close(false)} aria-hidden />
          <div ref={panel} id="phone-menu" className="phone-menu__panel" aria-hidden={!open} inert={!open}>
            <nav aria-label="Primary">
              <ul>
                {NAV_LINKS.map((l, i) => (
                  <li key={l.href} style={{ "--i": i } as React.CSSProperties}>
                    <a href={href(l.href)} onClick={() => close(false)} aria-current={current === l.href ? "page" : undefined} className="press flex items-center gap-3 rounded-xl px-3 py-3 active:bg-soft">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-display text-[21px] font-bold leading-tight">{l.label}{current === l.href && <span className="h-2 w-2 rounded-full bg-[#2da44e]" aria-hidden />}</span>
                        <span className="mt-0.5 block text-[14px] leading-snug text-ink-3">{l.blurb}</span>
                      </span>
                      <span aria-hidden className="text-ink-3">→</span>
                    </a>
                  </li>
                ))}
                <li style={{ "--i": NAV_LINKS.length } as React.CSSProperties}>
                  <EpochLink className="press flex items-center gap-3 rounded-xl px-3 py-3 active:bg-soft">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pl-1 pr-2.5 font-mono text-[12px] font-bold text-gold"><EpochCoin size={20} detail={false} />EPOCH</span>
                    <span className="flex-1 text-[14px] text-ink-3">The December fest{live ? " — live now" : ""}</span>
                    <span aria-hidden className="text-ink-3">→</span>
                  </EpochLink>
                </li>
              </ul>
            </nav>
            <div className="mt-4 border-t border-line px-3 pt-4"><SocialLinks /></div>
            <a href={href("/#join")} onClick={() => close(false)} className="press lift mt-5 block rounded-md border-2 border-ink bg-ink py-3.5 text-center font-display text-[16px] font-bold text-white">Join the club</a>
          </div>
        </div>,
        host,
      )}
    </>
  );
}
