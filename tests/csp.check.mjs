/* Loads every page in a real browser against the production build and reports any Content-Security-Policy violation.
   1. npm run build && npx next start -p 3100
   2. start Chromium/Edge with --remote-debugging-port=9333 (add --use-angle=swiftshader --enable-unsafe-swiftshader for the 3D coin)
   3. node tests/csp.check.mjs */
const tab = (await (await fetch("http://localhost:9333/json")).json()).find((t) => t.type === "page" && !t.url.startsWith("edge:"));
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const bad = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  if (d.method === "Log.entryAdded" && /Content Security Policy|Refused to/i.test(d.params.entry.text)) bad.push(d.params.entry.text.slice(0, 160));
  if (d.method === "Runtime.consoleAPICalled" && /Content Security Policy|Refused to/i.test(JSON.stringify(d.params.args))) bad.push(JSON.stringify(d.params.args).slice(0, 160));
  if (d.method === "Runtime.exceptionThrown") bad.push("EXC " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 140));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => res({}), 10000); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
await send("Log.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
for (const p of ["/", "/events/git-merge-26", "/privacy", "/epoch", "/epoch/booths", "/epoch/register", "/epoch/scan", "/epoch/leaderboard", "/unsubscribe?e=a%40b.in&t=x"]) {
  await send("Page.navigate", { url: "http://localhost:3100" + p }); await sleep(p === "/epoch" ? 7000 : 3000);
  if (p === "/epoch") { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 600, y: 400 }); await sleep(5000); console.log("3D canvas rendered under CSP:", await ev("!!document.querySelector('canvas')")); }
  if (p === "/") { // GitHub handle lookup uses api.github.com + avatars
    await ev(`(()=>{const i=document.querySelector('#join input[placeholder="your-github-handle"]'); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(i,'octocat'); i.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(3000);
    console.log("GitHub lookup + avatar under CSP:", await ev("!!document.querySelector('#join img[src*=githubusercontent]') || document.querySelector('#join p[role=status]')?.innerText"));
  }
}
console.log(bad.length ? "CSP VIOLATIONS:\n" + [...new Set(bad)].join("\n") : "no CSP violations or script errors on 9 pages");
process.exit(0);
