"use client";
import { createElement } from "react";

/* Fade-and-rise on scroll, in CSS (see .reveal in globals.css) with one shared IntersectionObserver —
   no animation library on the page. `group` doesn't fade the element itself; it only marks it `.in`
   so children can animate (.draw, .stagger, .pop). prefers-reduced-motion shows everything at once. */
let io: IntersectionObserver | null = null;
const observe = (el: Element) => {
  io ??= new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io!.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
  io.observe(el);
  return () => io?.unobserve(el);
};
// a callback ref: observe on mount, stop on unmount
const attach = (el: HTMLElement | null) => (el ? observe(el) : undefined);

export function Reveal({ children, delay = 0, className = "", as = "div", group = false }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "li" | "section" | "article" | "figure"; group?: boolean }) {
  return createElement(as, { ref: attach, className: `${group ? "reveal-group" : "reveal"} ${className}`, style: delay ? ({ "--rd": `${delay}s` } as React.CSSProperties) : undefined }, children);
}
