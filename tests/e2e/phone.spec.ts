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
