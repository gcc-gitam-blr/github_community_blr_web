/* Light or dark. The visitor's choice is kept in this browser; until they choose, the site follows their system.
   THEME_SCRIPT runs in <head> before the first paint (app/layout.tsx), so the page never flashes the wrong theme. */
export type ThemeChoice = "system" | "light" | "dark";
const KEY = "theme";

export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${KEY}");var d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;

const listeners = new Set<() => void>();
const systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

export function readChoice(): ThemeChoice {
  try { const c = localStorage.getItem(KEY); return c === "light" || c === "dark" ? c : "system"; } catch { return "system"; }
}
/** What the page shows right now. */
export const currentTheme = (): "light" | "dark" => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function apply(choice: ThemeChoice) {
  document.documentElement.dataset.theme = choice === "dark" || (choice === "system" && systemDark()) ? "dark" : "light";
  listeners.forEach((f) => f());
}
export function setChoice(choice: ThemeChoice) {
  try { if (choice === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch { /* storage blocked: it still applies for this visit */ }
  apply(choice);
}

/** For useSyncExternalStore: a change of choice, of the system setting, or in another tab. */
export function subscribeTheme(onChange: () => void) {
  listeners.add(onChange);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => { if (readChoice() === "system") apply("system"); };
  const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) apply(readChoice()); };
  mq.addEventListener("change", onSystem); window.addEventListener("storage", onStorage);
  return () => { listeners.delete(onChange); mq.removeEventListener("change", onSystem); window.removeEventListener("storage", onStorage); };
}
