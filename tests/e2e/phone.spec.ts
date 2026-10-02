import { expect, test } from "@playwright/test";

/* On a phone: nothing may scroll sideways, and the phone menu and tab bar work. */
const PAGES = ["/", "/learn", "/contribute", "/get-involved", "/privacy", "/updates", "/updates/calendar-2026-27", "/events/git-merge-26", "/epoch", "/epoch/booths", "/epoch/shop", "/epoch/leaderboard", "/epoch/register", "/epoch/wallet", "/epoch/scan", "/epoch/admin", "/no-such-page"];

for (const path of PAGES) {
  test(`${path} fits the screen`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(600);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll, `${path} is ${scroll}px wide on a ${client}px screen`).toBeLessThanOrEqual(client);
  });
}

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
  for (const path of ["/", "/epoch"]) {
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
