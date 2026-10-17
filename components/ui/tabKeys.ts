import type React from "react";

/* Keyboard support for a row of tabs (role="tablist"), as screen-reader users expect: the arrow keys move between tabs
   and select them, Home and End jump to the ends, and only the selected tab sits in the Tab order (each tab sets
   tabIndex={selected ? 0 : -1}). Put onKeyDown={tabKeys} on the tablist. */
export function tabKeys(e: React.KeyboardEvent<HTMLElement>) {
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])')];
  const i = tabs.indexOf(document.activeElement as HTMLElement), n = tabs.length;
  if (i < 0 || !n) return;
  const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
  if (to < 0) return;
  e.preventDefault();
  tabs[to].focus();
  tabs[to].click();
}
