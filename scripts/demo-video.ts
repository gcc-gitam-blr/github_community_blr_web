/* npm run demo:video — records "How Epoch works" for attendees: a captioned walkthrough clicked through the real pages.
   Build first with `npm run build:test`: it runs in demo mode (the wallet lives in the browser), so the recording never
   touches the real database. Starts its own server on 3100 (or PORT) unless one is already there.
   Writes demo-video/epoch-attendee.webm and a matching .srt (captions for YouTube, or a script to read a voiceover from).
   The organiser's check-in happens off camera in a second browser; every number in the captions comes from lib/epoch/config. */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import refuseRealBuild from "../tests/e2e/global-setup";
import { BOOTHS, EPOCH, RECHARGE_POINTS, STARTER_COINS } from "../lib/epoch/config";

const PORT = Number(process.env.PORT) || 3100, BASE = `http://localhost:${PORT}`;
const OUT = "demo-video", W = 1280, H = 720;
const C = EPOCH.currency, vr = BOOTHS.find((b) => b.id === "vr")!, recharge = RECHARGE_POINTS[0];

/* What the viewer sees on top of the page: a cursor that glides and ripples on clicks, a caption bar, and full-screen cards.
   It lives outside React (on <html>) and survives page loads through sessionStorage. */
const overlay = () => {
  const css = `
    #demo-cur,#demo-cap{inset:auto;margin:0;border:0;overflow:visible}
    #demo-cur{position:fixed;left:0;top:0;padding:0;background:none;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:transform 60ms linear;filter:drop-shadow(0 2px 3px rgb(0 0 0/.35))}
    .demo-rip{position:fixed;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:2px solid #fd8c73;z-index:2147483646;pointer-events:none;animation:demo-rip .5s ease-out forwards}
    @keyframes demo-rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
    #demo-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:min(980px,90vw);padding:12px 22px;border-radius:12px;background:rgb(13 17 23/.92);color:#f0f6fc;font:500 21px/1.35 "Mona Sans",system-ui,sans-serif;letter-spacing:-.01em;text-align:center;z-index:2147483645;pointer-events:none;transition:opacity .25s}
    #demo-cap:empty{opacity:0}
    #demo-cap.top{bottom:auto;top:84px}
    #demo-card:not(.off)~#demo-cur{opacity:0}
    #demo-card{position:fixed;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 9vw;background:#0d1117;color:#f0f6fc;z-index:2147483644;font-family:"Mona Sans",system-ui,sans-serif;transition:opacity .4s}
    #demo-card.off{opacity:0;pointer-events:none}
    #demo-card p{margin:0;font:13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8b949e;letter-spacing:.02em}
    #demo-card h1{margin:14px 0 0;font-size:64px;font-weight:500;line-height:1;letter-spacing:-.045em}
    #demo-card div{margin-top:18px;max-width:46ch;font-size:24px;line-height:1.35;color:#c9d1d9}`;
  const mount = () => {
    if (document.getElementById("demo-cur")) return;
    const st = document.createElement("style"); st.textContent = css; document.documentElement.append(st);
    const cur = document.createElement("div"); cur.id = "demo-cur";
    cur.innerHTML = `<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2l15 8.5-6.6 1.6L8 18z" fill="#0d1117" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    const cap = document.createElement("div"); cap.id = "demo-cap";
    const card = document.createElement("section"); card.id = "demo-card"; card.className = "off";
    document.documentElement.append(cap, card, cur);
    // caption and cursor live in the top layer, so a modal dialog's backdrop doesn't cover them; raise them again after one opens
    const raise = () => { for (const el of [cap, cur]) { el.popover = "manual"; if (el.matches(":popover-open")) el.hidePopover(); el.showPopover(); } };
    (window as unknown as { demoRaise: () => void }).demoRaise = raise; raise();
    const at = (x: number, y: number) => { cur.style.transform = `translate(${x - 3}px,${y - 2}px)`; sessionStorage.setItem("demo:xy", `${x},${y}`); };
    const [x, y] = (sessionStorage.getItem("demo:xy") ?? "640,360").split(",").map(Number); at(x, y);
    addEventListener("mousemove", (e) => at(e.clientX, e.clientY), true);
    addEventListener("mousedown", (e) => { const r = document.createElement("div"); r.className = "demo-rip"; r.style.left = `${e.clientX}px`; r.style.top = `${e.clientY}px`; document.documentElement.append(r); setTimeout(() => r.remove(), 600); }, true);
    cap.textContent = sessionStorage.getItem("demo:cap") ?? "";
    const c = sessionStorage.getItem("demo:card"); if (c) { card.innerHTML = c; card.className = ""; }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
};

/* captions are also written as subtitles, timed from the start of the video */
let t0 = 0; const lines: { at: number; text: string }[] = [];
const caption = async (page: Page, text: string) => {
  lines.push({ at: Date.now() - t0, text });
  await page.evaluate((t) => { sessionStorage.setItem("demo:cap", t); const el = document.getElementById("demo-cap"); if (el) el.textContent = t; }, text);
};
const cardHtml = (kicker: string, title: string, sub: string) => `<p>${kicker}</p><h1>${title}</h1><div>${sub}</div>`;
const card = async (page: Page, kicker: string, title: string, sub: string) => {
  lines.push({ at: Date.now() - t0, text: `${title} ${sub}` });
  const html = cardHtml(kicker, title, sub);
  await page.evaluate((h) => { sessionStorage.setItem("demo:card", h); sessionStorage.setItem("demo:cap", ""); const c = document.getElementById("demo-card")!; c.innerHTML = h; c.className = ""; document.getElementById("demo-cap")!.textContent = ""; }, html);
};
const uncard = (page: Page) => page.evaluate(() => { sessionStorage.removeItem("demo:card"); document.getElementById("demo-card")!.className = "off"; });

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const go = async (page: Page, url: string) => { await page.goto(url); await page.waitForLoadState("networkidle"); };
/* glide to an element like a person would; the caption moves to the top while the action is low on the screen */
const point = async (page: Page, target: Locator) => {
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  await page.evaluate((top) => document.getElementById("demo-cap")?.classList.toggle("top", top), b.y + b.height / 2 > H * 0.6);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 28 });
  await pause(250);
};
const click = async (page: Page, target: Locator) => { await point(page, target); await target.click(); };
const type = async (page: Page, target: Locator, text: string) => { await click(page, target); await target.pressSequentially(text, { delay: 55 }); };
const scroll = async (page: Page, dy: number) => { for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, dy / 12); await pause(45); } };
/* move around the way a person would, through the side rail: no page reloads, and viewers learn where things are */
const rail = async (page: Page, name: RegExp) => { await click(page, page.getByRole("link", { name }).filter({ visible: true }).first()); await page.waitForLoadState("networkidle"); await pause(400); };
const scanCode = async (page: Page, code: string) => {
  await type(page, page.getByPlaceholder(/or paste a code/), code);
  await click(page, page.getByRole("button", { name: "Go", exact: true }));
};

/* Off camera: the registration desk. An organiser signs in on another browser and verifies the ticket.
   Demo mode keeps everything in localStorage, so the state is carried across and back. */
const checkInOffCamera = async (browser: Browser, page: Page, handle: string) => {
  const store = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const desk = await browser.newContext({ baseURL: BASE, viewport: { width: W, height: H } });
  const p = await desk.newPage();
  await p.goto("/epoch");
  await p.evaluate((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); localStorage.removeItem("epoch:me"); }, store);
  await p.goto("/epoch/register");
  await p.getByPlaceholder("@your-handle").fill("desk"); await p.getByPlaceholder("Ada Lovelace").fill("Registration desk"); await p.getByPlaceholder("you@gitam.in").fill("desk@gitam.in");
  await p.getByRole("button", { name: "Create my profile" }).click(); await p.waitForURL("**/epoch/wallet");
  await p.goto("/epoch/admin");
  await p.getByPlaceholder("organiser code").fill("epoch-admin"); await p.getByRole("button", { name: "Unlock" }).click();
  const id = await p.evaluate((h) => (Object.values(JSON.parse(localStorage.getItem("epoch:users")!)) as { id: string; handle: string }[]).find((u) => u.handle === h)!.id, handle);
  await p.goto(`/epoch/scan?u=${id}`);
  await p.getByRole("button", { name: /Verify ticket/ }).click();
  await p.getByText(`+${STARTER_COINS}`).waitFor();
  // a few Octodex characters already on the leaderboard, so it isn't empty (demo data, only in this browser)
  await p.evaluate(() => {
    const u = JSON.parse(localStorage.getItem("epoch:users")!);
    for (const [h, name, earned] of [["octocat", "Octocat", 80], ["hubot", "Hubot", 60], ["mona", "Monalisa", 40]] as const) u[`demo-${h}`] = { id: `demo-${h}`, handle: h, name, email: `${h}@example.com`, coins: 0, earned, ticket: true, role: "attendee", createdAt: "2026-12-01" };
    localStorage.setItem("epoch:users", JSON.stringify(u));
  });
  const after = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await desk.close();
  await page.evaluate(([s, me]) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); localStorage.setItem("epoch:me", JSON.stringify(me)); }, [after, id] as const);
};

const srtTime = (ms: number) => { const h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };

async function up() { try { return (await fetch(BASE)).ok; } catch { return false; } }

async function main() {
  refuseRealBuild();
  if (!fs.existsSync(".next/BUILD_ID")) throw new Error("No build found. Run `npm run build:test` first.");
  let server: ChildProcess | null = null;
  if (!(await up())) {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, NODE_ENV: "test" }, stdio: "ignore" });
    for (let i = 0; i < 60 && !(await up()); i++) await pause(1000);
    if (!(await up())) throw new Error(`The server didn't start on ${BASE}.`);
  }
  const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
  try {
    fs.mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: W, height: H }, colorScheme: "light", recordVideo: { dir: OUT, size: { width: W, height: H } } });
    // the title card is up from the first frame, while the first page loads behind it (a fresh browser: nobody signed in)
    const title = cardHtml(`${EPOCH.name}_${EPOCH.edition} · for attendees`, "How Epoch works.", `Your ticket, your coins and the booths, in about a minute and a half. ${EPOCH.dates}.`);
    await ctx.addInitScript({ content: `window.__name = (f) => f; if (!sessionStorage.getItem("demo:on")) { sessionStorage.setItem("demo:on", "1"); sessionStorage.setItem("demo:card", ${JSON.stringify(title)}); } (${overlay})();` }); // tsx names inner functions with a helper the page doesn't have
    const page = await ctx.newPage(); t0 = Date.now();
    lines.push({ at: 0, text: "How Epoch works. Your ticket, your coins and the booths, in about a minute and a half." });
    await go(page, "/epoch"); await pause(4000); await uncard(page);

    await caption(page, `Epoch is the club's two-day fest. Everything runs on Epoch Coins (${C}).`);
    await pause(2500); await scroll(page, 1500); await pause(3000); await scroll(page, -1500); await pause(800);

    await caption(page, "Press / anywhere to ask a question, like what a booth costs.");
    await page.keyboard.press("/"); await pause(600);
    await page.getByRole("dialog").getByPlaceholder(/Search booths/).pressSequentially(`how much is ${vr.id}`, { delay: 70 });
    await pause(3200); await page.keyboard.press("Escape"); await pause(600);

    await caption(page, "Before you come: create your profile. On the day you sign in with your GitHub account.");
    await click(page, page.getByRole("link", { name: "Get your ticket" }).first()); await page.waitForURL("**/epoch/register"); await pause(800);
    await type(page, page.getByPlaceholder("@your-handle"), "octo-learner");
    await type(page, page.getByPlaceholder("Ada Lovelace"), "Octo Learner");
    await type(page, page.getByPlaceholder("you@gitam.in"), "octo@gitam.in");
    await click(page, page.getByRole("button", { name: "Create my profile" }));
    await page.waitForURL("**/epoch/wallet"); await page.waitForLoadState("networkidle");

    await caption(page, "You get a wallet with your own QR code. The ticket stays pending until the desk checks you in.");
    await point(page, page.getByText("Ticket pending").first()); await pause(4000);

    await card(page, "At the registration desk", "Pay, get scanned, get coins.", `Pay for your ticket at the desk (there's no online payment). A volunteer scans your wallet QR and ${STARTER_COINS} ${C} land in your wallet, once.`);
    await checkInOffCamera(browser, page, "octo-learner");
    await page.getByText("Ticket verified").first().waitFor({ timeout: 15_000 }); await pause(1500); await uncard(page); // the wallet picks it up by itself
    await caption(page, `Checked in: ${STARTER_COINS} ${C}, and the wallet updates by itself.`);
    await point(page, page.getByText("Ticket verified").first()); await pause(3500);

    await caption(page, `Each booth costs a few coins per session. ${vr.name} is ${vr.coins}.`);
    await rail(page, /^Booths/); await pause(1200); await scroll(page, 600); await pause(2500); await scroll(page, -600); await pause(400);

    await caption(page, "At a booth, tap Scan and point your camera at its QR. Here we type the code in.");
    await rail(page, /^Scan$/);
    await scanCode(page, `epoch:b:${vr.id}`);
    await page.getByText(`New balance ${STARTER_COINS - vr.coins}`).waitFor(); await pause(3500);

    await caption(page, `Recharge points: win the quick challenge and get +${recharge.coins} ${C}, once at each point.`);
    await click(page, page.getByRole("button", { name: "Scan another" }));
    await scanCode(page, `epoch:b:${recharge.id}`);
    await page.getByText(`New balance ${STARTER_COINS - vr.coins + recharge.coins}`).waitFor(); await pause(3500);

    await caption(page, "Spend coins on merch, then show the receipt at the Merchandise Stall.");
    await rail(page, /^Shop$/); await pause(1000); await click(page, page.getByRole("button", { name: "Buy" }).first());
    await page.getByText(/^Bought /).first().waitFor(); await pause(3000);

    await caption(page, "Every line in your wallet opens a receipt: what, where, when and your balance after it.");
    await rail(page, /^Wallet$/); await pause(1000); await click(page, page.getByRole("button", { name: new RegExp(`^${vr.name}`) }));
    await page.getByRole("dialog").getByText("Balance after").waitFor();
    await page.evaluate(() => (window as unknown as { demoRaise: () => void }).demoRaise()); await pause(3500);
    await page.keyboard.press("Escape"); await pause(600);

    await caption(page, "The leaderboard counts what you earn, so spending never lowers your rank.");
    await rail(page, /^Board$/); await pause(1200); await point(page, page.getByText("Octo Learner").first()); await pause(3500);

    await card(page, `${EPOCH.name}_${EPOCH.edition}`, "See you at Epoch.", `${EPOCH.dates} · ${EPOCH.venue}. Everything here is on one printable page: /epoch/guide. Questions? Ask any volunteer.`);
    await pause(4500);
    lines.push({ at: Date.now() - t0, text: "" });

    const video = page.video()!;
    await ctx.close();
    const file = path.join(OUT, "epoch-attendee.webm");
    await video.saveAs(file); await video.delete();
    const srt = lines.slice(0, -1).map((l, i) => `${i + 1}\n${srtTime(l.at)} --> ${srtTime(lines[i + 1].at)}\n${l.text}\n`).join("\n");
    fs.writeFileSync(path.join(OUT, "epoch-attendee.srt"), srt);
    console.log(`Saved ${file} (${((Date.now() - t0) / 1000).toFixed(0)} s) and its captions, epoch-attendee.srt.`);
  } finally {
    await browser.close();
    server?.kill();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
