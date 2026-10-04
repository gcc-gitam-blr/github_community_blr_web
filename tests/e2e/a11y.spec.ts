import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/* Automated accessibility checks (axe-core, WCAG 2.1 A/AA). They catch contrast, labels, names, roles and more.
   They don't replace trying the site with a keyboard and a screen reader, but they stop regressions. */
const PAGES = ["/", "/learn", "/contribute", "/board", "/memories", "/get-involved", "/privacy", "/updates", "/updates/calendar-2026-27", "/events/git-merge-26", "/epoch", "/epoch/booths", "/epoch/shop", "/epoch/register", "/epoch/leaderboard", "/unsubscribe?e=a%40b.in&t=x", "/admin", "/no-such-page"];

for (const path of PAGES) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(1500); // let entrance animations settle so contrast is measured on final colours
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} — ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}

test("the whole site can be used with the keyboard: skip link, then the first interactive controls", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("main") !== null)).toBe(true); // focus moved into the page content
});

test("reduced motion: content is visible without waiting for animations", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", baseURL });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /What is GitHub/ })).toBeVisible({ timeout: 2000 });
  await ctx.close();
});
