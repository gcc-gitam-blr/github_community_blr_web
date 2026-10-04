/* Error reports from browsers: what gets cleaned away, what's kept, how /admin groups them, and /api/errors. */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { browserFamily, cleanPath, cleanReport, groupErrors, perDay, scrub, worthReporting, type ErrorRow } from "../lib/client-errors";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const saved: Record<string, unknown>[] = []; let down = false;
const fake = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  if (req.url?.startsWith("/rest/v1/rpc/log_client_error")) { if (down) { res.writeHead(500); return res.end("{}"); } saved.push(JSON.parse(b)); res.writeHead(200, { "content-type": "application/json" }); return res.end("true"); }
  res.writeHead(404); res.end(); // rate_hit isn't here: the per-server limiter takes over
}); });
const PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36";
const post = (body: unknown, ip: string, ua = PHONE) => new Request("http://x/api/errors", { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8", "user-agent": ua, "x-forwarded-for": ip }, body: typeof body === "string" ? body : JSON.stringify(body) });

(async () => {
  ok("emails are removed", scrub("Invalid user ada.l+club@gitam.ac.in in form", 300) === "Invalid user [email] in form");
  ok("query strings and #fragments are removed from links", scrub("at x (https://club.test/epoch/register?e=a#sb_token=secret:1:2)", 300) === "at x (https://club.test/epoch/register:1:2)");
  ok("…but a React error number survives", scrub("Minified React error #418; visit https://react.dev/errors/418?args[]=x", 300) === "Minified React error #418; visit https://react.dev/errors/418");
  ok("long text is capped", scrub("x".repeat(500), 300).length === 300);
  ok("certificate ids in paths are hidden", cleanPath("/certificates/3f2a9c1e-1111-4222-8333-444455556666") === "/certificates/:id");
  ok("other sites' scripts and extensions are ignored", !worthReporting("Script error.") && !worthReporting("x", "at chrome-extension://abc/x.js") && !worthReporting("ResizeObserver loop completed with undelivered notifications."));
  ok("a real error is worth reporting", worthReporting("TypeError: Cannot read properties of undefined (reading 'coins')"));
  ok("browser family: Chrome on a phone", browserFamily(PHONE) === "Chrome (phone)");
  ok("browser family: Safari on an iPhone", browserFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1") === "Safari (phone)");
  ok("browser family: Edge on a laptop", browserFamily("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0") === "Edge");
  ok("bots aren't recorded", browserFamily("Mozilla/5.0 (compatible; Googlebot/2.1)") === null);
  const r = cleanReport({ message: "TypeError: boom for ada@gitam.in", stack: "at a (https://club.test/x.js?dpl=1:1:1)", path: "/unsubscribe?e=ada@gitam.in", form: { email: "x@y.in" } }, PHONE);
  ok("a report keeps only message, stack, path and browser", !!r && Object.keys(r).sort().join() === "browser,message,path,stack");
  ok("…with the email, the query string and the extra fields gone", !!r && !JSON.stringify(r).includes("gitam.in") && !JSON.stringify(r).includes("y.in") && r.path === "/unsubscribe");
  ok("a report without a page path is refused", cleanReport({ message: "x" }, PHONE) === null && cleanReport({ message: "x", path: "https://evil.test/" }, PHONE) === null);

  const at = (h: number) => new Date(Date.UTC(2026, 9, 4, h)).toISOString();
  const rows: ErrorRow[] = [
    { id: 1, message: "A", stack: "s1", path: "/epoch", browser: "Chrome (phone)", created_at: at(1) },
    { id: 2, message: "B", stack: null, path: "/", browser: "Safari (phone)", created_at: at(5) },
    { id: 3, message: "A", stack: "s3", path: "/board", browser: "Chrome (phone)", created_at: at(3) },
    { id: 4, message: "A", stack: "s4", path: "/epoch", browser: "Firefox", created_at: at(2) },
  ];
  const g = groupErrors(rows);
  ok("the same message from many phones is one line, most frequent first", g.length === 2 && g[0].message === "A" && g[0].count === 3 && g[1].count === 1);
  ok("…with when it last happened and its latest stack", g[0].last === at(3) && g[0].stack === "s3");
  ok("…and each page and browser once", g[0].paths.join() === "/board,/epoch" && g[0].browsers.join() === "Chrome (phone),Firefox");
  const days = perDay(rows, 30, new Date(at(12)));
  ok("reports per day: 30 days, ending today", days.length === 30 && days[29].day === "2026-10-04" && days[29].count === 4 && days[0].count === 0);

  const { POST } = await import("../app/api/errors/route");
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  let res = await POST(post({ message: "TypeError: x", path: "/" }, "1.1.1.1"));
  ok("without Supabase: 204 and nothing happens", res.status === 204 && saved.length === 0);

  const port = await new Promise<number>((r) => fake.listen(0, "127.0.0.1", () => r((fake.address() as AddressInfo).port)));
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" });
  res = await POST(post({ message: "TypeError: x for a@b.in", stack: "at y (https://club.test/a.js?v=1:1:1)", path: "/epoch" }, "2.2.2.2"));
  ok("a report sent with sendBeacon (text/plain) is stored", res.status === 204 && saved.length === 1);
  ok("…cleaned on the server too", saved[0].p_message === "TypeError: x for [email]" && saved[0].p_stack === "at y (https://club.test/a.js:1:1)" && saved[0].p_path === "/epoch" && saved[0].p_browser === "Chrome (phone)");
  ok("not JSON is a 400", (await POST(post("not json", "3.3.3.3"))).status === 400);
  ok("a huge body is a 400", (await POST(post({ message: "x", path: "/", stack: "y".repeat(9000) }, "3.3.3.3"))).status === 400);
  ok("a bot's report is dropped", (await POST(post({ message: "x", path: "/" }, "3.3.3.3", "Googlebot/2.1"))).status === 400 && saved.length === 1);
  down = true; res = await POST(post({ message: "TypeError: z", path: "/" }, "4.4.4.4")); down = false;
  ok("a database error still answers 204: the visitor never notices", res.status === 204);
  let last = 0; for (let i = 0; i < 22; i++) last = (await POST(post({ message: `E${i}`, path: "/" }, "5.5.5.5"))).status;
  ok("the 21st report from one IP in 10 minutes is refused", last === 429);

  fake.close();
  console.log(fails ? `\n${fails} FAILED` : "\nall error-report checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
