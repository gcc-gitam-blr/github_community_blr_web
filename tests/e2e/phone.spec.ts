import { expect, test } from "@playwright/test";
import { CLUB } from "@/lib/config";
import { EVENTS, eventSlug } from "@/lib/events";
import { getUpdates } from "@/lib/updates";

/* On a phone: nothing may scroll sideways, and the phone menu and tab bar work. */
const PAGES = ["/", "/learn", "/contribute", "/board", "/memories", "/get-involved", "/join", "/apply", "/projects", "/hub", "/privacy", "/updates", `/updates/${getUpdates()[0].slug}`, `/events/${eventSlug(EVENTS[0])}`, "/epoch", "/epoch/booths", "/epoch/shop", "/epoch/leaderboard", "/epoch/register", "/epoch/wallet", "/epoch/scan", "/epoch/admin", "/epoch/guide", "/epoch/guide/organisers", "/epoch/kiosk/vr", "/no-such-page"];

for (const path of PAGES) {
  test(`${path} fits the screen`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(600);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll, `${path} is ${scroll}px wide on a ${client}px screen`).toBeLessThanOrEqual(client);
  });
}

test("the booth kiosk fills the screen without scrolling, QR and all", async ({ page }) => {
  await page.goto("/epoch/kiosk/vr");
  await expect(page.getByRole("heading", { level: 1, name: "Virtual Reality Merge Zone" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Epoch tabs" })).toHaveCount(0); // no tab bar or footer around it
  await expect(page.locator("footer")).toHaveCount(0);
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, client: window.innerHeight }));
  expect(scroll).toBeLessThanOrEqual(client);
  await expect(page.getByRole("img", { name: /QR code for/ })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText(/tap Scan and point it here/)).toBeInViewport({ ratio: 1 });
});

test("the phone menu opens and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "About" }).click();
  await expect(page.getByRole("heading", { name: /A community that/ })).toBeInViewport();
});

test("Epoch shows the tab bar with a scan button", async ({ page }) => {
  await page.goto("/epoch");
  const tabs = page.getByRole("navigation", { name: "Epoch tabs" });
  await expect(tabs).toBeVisible();
  await tabs.getByRole("link", { name: "Scan" }).click();
  await expect(page).toHaveURL(/\/epoch\/scan/);
});

test("the phone menu: focus moves in, the page stops scrolling, Esc closes and returns focus", async ({ page }) => {
  await page.goto("/updates");
  const button = page.getByRole("button", { name: "Open menu" });
  await button.click();
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Learn/ })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Updates/ })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
});

test("the smallest phones (320px): the home page and Epoch fit, including the ticket", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const path of ["/", "/epoch", "/epoch/guide", "/epoch/guide/organisers", "/epoch/kiosk/vr"]) {
    await page.goto(path); await page.waitForTimeout(600);
    const { scroll, client, culprits } = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      // name what sticks out (fixed bars count too), so a failure says where to look
      const culprits = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > vw + 0.5)
        .slice(0, 6).map((e) => `${e.tagName}.${String((e as HTMLElement).className).slice(0, 60)} → ${e.getBoundingClientRect().right.toFixed(1)}`);
      return { scroll: document.documentElement.scrollWidth, client: vw, culprits };
    });
    expect(scroll, `${path} — ${culprits.join(" | ")}`).toBeLessThanOrEqual(client);
  }
  // nothing in the ticket section reaches past the right edge (it clips instead of scrolling, so check directly)
  const past = await page.evaluate(() => [...document.querySelectorAll("#ticket *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length);
  expect(past).toBe(0);
  await ctx.close();
});

test("phones never download the animated 3D stickers (they're desktop-only)", async ({ page }) => {
  const heavy: string[] = [];
  page.on("request", (r) => { if (/\/stickers\/(cat|duck)-3d\.webp/.test(r.url())) heavy.push(r.url()); });
  for (const path of ["/", "/learn"]) { await page.goto(path); await page.mouse.wheel(0, 6000); await page.waitForTimeout(800); }
  expect(heavy).toEqual([]);
});

test("a Join button arrives in the header once the hero's form scrolls away, never on /join, and the menu always fits", async ({ page }) => {
  const join = page.locator("header a[href='/join']");
  await page.goto("/");
  await expect(join).toBeHidden(); // the hero's own form is right there
  await page.locator("#about").scrollIntoViewIfNeeded();
  await expect(join).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 760 });
    const menu = await page.getByRole("button", { name: "Open menu" }).boundingBox();
    expect(menu!.width, `menu button at ${width}px`).toBeGreaterThanOrEqual(40);
    expect(menu!.x + menu!.width, `menu button at ${width}px`).toBeLessThanOrEqual(width);
  }
  await page.goto("/learn");
  await expect(join).toBeVisible(); // no hero form off the home page
  await page.goto("/join");
  await expect(join).toBeHidden(); // the page is the form
  await page.evaluate(() => localStorage.setItem("gcc-joined", JSON.stringify({ name: "Ada Lovelace", email: "ada@gitam.in", extras: "later" })));
  await page.goto("/learn");
  await expect(join).toHaveCount(0); // joined on this browser: no more Join buttons
});

test("the contributors show ten until 'Show all'", async ({ page }) => {
  await page.goto("/");
  const box = page.locator("#team").getByRole("heading", { name: /Contributors/ }).locator("..");
  await box.scrollIntoViewIfNeeded();
  const chips = box.locator("li:visible");
  const total = CLUB.contributors.length;
  if (total <= 10) { await expect(chips).toHaveCount(total); return; }
  await expect(chips).toHaveCount(10);
  await box.getByRole("button", { name: `Show all ${total}` }).click();
  await expect(chips).toHaveCount(total);
});
