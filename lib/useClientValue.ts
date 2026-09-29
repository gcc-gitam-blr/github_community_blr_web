import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** A value that only exists in the browser (today's date, the page origin, WebGL support…).
    The server and the first client render use `server`; then it switches to `get()` — without
    a setState-in-effect round trip. `get` must return a primitive (compared with Object.is). */
export function useClientValue<T extends string | number | boolean | null>(get: () => T, server: T): T {
  return useSyncExternalStore(noSubscribe, get, () => server);
}

/** Today's date as YYYY-MM-DD in the visitor's timezone; "" during server render. */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
