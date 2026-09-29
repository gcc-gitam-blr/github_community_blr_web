/* End-to-end check of the Epoch coin flow through the real pages (demo store).
   1. npm run build && npx next start -p 3100
   2. start a Chromium/Edge with --remote-debugging-port=9333
   3. node tests/e2e.epoch.mjs [screenshot-dir] */
// End-to-end: the Epoch coin flow driven through the real UI (demo store).
import fs from "fs";
const OUT = process.argv[2] || ".", B = "http://localhost:3100";
const tab = (await (await fetch("http://localhost:9333/json")).json()).find((t) => t.type === "page" && !t.url.startsWith("edge:"));
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => res({}), 10000); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
const go = async (p) => { await send("Page.navigate", { url: B + p }); await sleep(2600); };
const type = async (sel, text) => { await ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); el.focus(); el.select?.(); return !!el})()`); await send("Input.insertText", { text }); await sleep(150); };
const click = async (txt) => { const ok = await ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim().startsWith(${JSON.stringify(txt)})); if(!b) return false; b.click(); return true})()`); await sleep(1200); return ok; };
const text = () => ev("document.querySelector('main').innerText");
const shot = async (n) => { const r = await send("Page.captureScreenshot", { format: "png" }); if (r.data) fs.writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64")); };
let fails = 0; const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails++; };
const register = async (handle, name) => { await go("/epoch/register"); await type('input[placeholder="@your-handle"]', handle); await type('input[autocomplete="name"]', name); await type('input[type="email"]', handle + "@gitam.in"); await click("Create my profile"); await sleep(1500); };
const scanCode = async (code) => { await go("/epoch/scan"); await type('input[placeholder^="or paste a code"]', code); await click("Go"); await sleep(1000); return text(); };
const signOut = async () => { await go("/epoch/wallet"); await click("Sign out"); };
const balance = async () => { const s = JSON.parse(await ev("localStorage.getItem('epoch:users')")); const me = JSON.parse(await ev("localStorage.getItem('epoch:me')")); return s[me]; };

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await go("/epoch"); await ev("localStorage.clear()");

// 1. attendee registers
await register("ada", "Ada Lovelace");
let me = await balance(); const adaId = me?.id;
ok("attendee profile created with 0 coins, ticket pending", me?.coins === 0 && me?.ticket === false);
ok("wallet page says ticket pending", (await text()).includes("Ticket pending"));
// 2. cannot spend before the ticket is verified
ok("scanning VR before verification is refused", (await scanCode("epoch:b:vr")).includes("hasn't been verified"));
// 3. organiser unlocks the desk
await signOut(); await register("org", "Organiser");
await go("/epoch/admin"); await type('input[placeholder="organiser code"]', "wrong"); await click("Unlock");
ok("wrong organiser code is rejected", (await text()).includes("Wrong organiser code"));
await type('input[placeholder="organiser code"]', "epoch-admin"); await click("Unlock");
ok("organiser desk unlocks with the right code", (await text()).includes("Organiser desk"));
// 4. organiser scans Ada's wallet QR and verifies the ticket
let t = await scanCode("epoch:u:" + adaId);
ok("scanning the wallet QR shows the attendee", t.includes("Ada Lovelace") && t.includes("ticket pending"));
await click("Verify ticket"); await shot("e2e-verify");
ok("verifying the ticket credits +398", (await text()).includes("+398"));
t = await scanCode("epoch:u:" + adaId);
ok("a second verification is not offered", t.includes("ticket verified") && !t.includes("Verify ticket"));
// 5. Ada spends and recharges
await signOut(); await register("ada", "Ada Lovelace");
ok("Ada logs back in with 398 coins, ticket verified", (await balance()).coins === 398 && (await text()).includes("Ticket verified"));
t = await scanCode("epoch:b:vr"); ok("VR session costs 40 → 358", t.includes("−40") && t.includes("New balance 358"));
await click("Scan another"); await type('input[placeholder^="or paste a code"]', "epoch:b:vr"); await click("Go");
ok("an immediate second VR scan is blocked", (await text()).includes("Just scanned"));
t = await scanCode("epoch:b:recharge-trivia"); ok("recharge point pays +20 → 378", t.includes("+20") && t.includes("New balance 378"));
t = await scanCode("epoch:b:recharge-trivia"); ok("the same recharge point refuses a second go", t.includes("One attempt per recharge point"));
t = await scanCode("epoch:b:not-a-booth"); ok("an unknown booth code is refused", t.includes("isn't a coin booth"));
// 6. merch
await go("/epoch/shop"); await click("Buy"); ok("buying a sticker pack (40) → 338", (await balance()).coins === 338);
ok("sticker stock drops from 200 to 199", (await text()).includes("199 left"));
// 7. wallet + leaderboard reflect it all
await go("/epoch/wallet"); await sleep(1500); await shot("e2e-wallet");
t = await text(); ok("wallet shows 338 and 4 of 5 recharge points left", t.includes("338") && t.includes("4 left"));
ok("ledger lists ticket, VR, recharge and purchase", ["Ticket ₹199", "Virtual Reality Merge Zone", "Tech Trivia Point", "Bought Octocat Sticker Pack"].every((s) => t.includes(s)));
await go("/epoch/leaderboard"); t = await text(); ok("leaderboard ranks Ada by 20 earned (spending doesn't count)", t.includes("Ada Lovelace") && /Ada Lovelace[\s\S]*20/.test(t));
console.log(fails ? `\n${fails} FAILED` : "\nall end-to-end checks passed"); process.exit(fails ? 1 : 0);
