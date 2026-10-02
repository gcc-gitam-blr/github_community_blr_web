import { expect, test, type Page } from "@playwright/test";

/* The Epoch coin flow, clicked through the real pages in demo mode (the browser's localStorage is the database). */
const register = async (page: Page, handle: string, name: string) => {
  await page.goto("/epoch/register");
  await page.getByPlaceholder("@your-handle").fill(handle);
  await page.getByPlaceholder("Ada Lovelace").fill(name);
  await page.getByPlaceholder("you@gitam.in").fill(`${handle}@gitam.in`);
  await page.getByRole("button", { name: "Create my profile" }).click();
  await page.waitForURL("**/epoch/wallet");
};
const scan = async (page: Page, code: string) => {
  await page.goto("/epoch/scan");
  await page.getByPlaceholder(/or paste a code/).fill(code);
  await page.getByRole("button", { name: "Go", exact: true }).click();
};
const signOut = async (page: Page) => { await page.goto("/epoch/wallet"); await page.getByRole("button", { name: "Sign out" }).click(); await page.waitForURL("**/epoch"); };
const userId = (page: Page, handle: string) => page.evaluate((h) => { const u = JSON.parse(localStorage.getItem("epoch:users") ?? "{}"); return (Object.values(u) as { id: string; handle: string }[]).find((x) => x.handle === h)!.id; }, handle);

test("a full Epoch day: check-in, spend, recharge, shop, ledger", async ({ page }) => {
  await page.goto("/epoch"); await page.evaluate(() => localStorage.clear());

  // attendee signs up: no coins, ticket pending
  await register(page, "ada", "Ada Lovelace");
  await expect(page.getByText("Ticket pending")).toBeVisible();
  await scan(page, "epoch:b:vr");
  await expect(page.getByText(/hasn't been verified/)).toBeVisible();
  const adaId = await userId(page, "ada");

  // organiser unlocks the desk and checks Ada in
  await signOut(page); await register(page, "org", "Organiser");
  await page.goto("/epoch/admin");
  await page.getByPlaceholder("organiser code").fill("wrong"); await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Wrong organiser code")).toBeVisible();
  await page.getByPlaceholder("organiser code").fill("epoch-admin"); await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: /Organiser desk/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Club at a glance" })).toBeVisible(); // demo mode explains how to connect the database
  await scan(page, `epoch:u:${adaId}`);
  await expect(page.getByText(/Ada Lovelace/)).toBeVisible();
  await page.getByRole("button", { name: /Verify ticket/ }).click();
  await expect(page.getByText("+398")).toBeVisible();
  await scan(page, `epoch:u:${adaId}`);
  await expect(page.getByRole("button", { name: /Verify ticket/ })).toHaveCount(0); // a second check-in isn't offered

  // Ada logs back in and uses the coins
  await signOut(page); await register(page, "ada", "Ada Lovelace");
  await expect(page.getByText("Ticket verified")).toBeVisible();
  await scan(page, "epoch:b:vr");
  await expect(page.getByText("New balance 358")).toBeVisible();
  await page.getByRole("button", { name: "Scan another" }).click();
  await page.getByPlaceholder(/or paste a code/).fill("epoch:b:vr"); await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(page.getByText(/Just scanned/)).toBeVisible(); // double-scan guard
  await scan(page, "epoch:b:recharge-trivia");
  await expect(page.getByText("New balance 378")).toBeVisible();
  await scan(page, "epoch:b:recharge-trivia");
  await expect(page.getByText(/One attempt per recharge point/)).toBeVisible();
  await scan(page, "epoch:b:not-a-booth");
  await expect(page.getByText(/isn't a coin booth/)).toBeVisible();

  // merch
  await page.goto("/epoch/shop");
  await page.getByRole("button", { name: "Buy" }).first().click();
  await expect(page.getByText(/Bought Octocat Sticker Pack/)).toBeVisible();
  await expect(page.getByText("199 left")).toBeVisible();

  // wallet, ledger and leaderboard agree
  await page.goto("/epoch/wallet");
  await expect(page.getByText("338", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("4 left")).toBeVisible();
  for (const row of ["Check-in → 398", "Virtual Reality Merge Zone", "Tech Trivia Point", "Bought Octocat Sticker Pack"]) await expect(page.getByText(row).first()).toBeVisible();
  await page.goto("/epoch/leaderboard");
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await expect(page.getByText("20", { exact: true })).toBeVisible(); // earned counts recharges, not the 398 or spending
});

test("the command bar answers a question about the VR booth", async ({ page }) => {
  await page.goto("/epoch");
  await page.keyboard.press("/");
  await page.getByRole("dialog").getByPlaceholder(/Search booths/).fill("how much is vr");
  await expect(page.getByRole("dialog").getByText("40 coins per session")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 25_000 }); // the exit animation shares a thread with the 3D coin, which renders in software on CI
});

test("the booth groups show one group at a time", async ({ page }) => {
  await page.goto("/epoch");
  const tabs = page.getByRole("tablist", { name: "Booth groups" });
  await expect(page.getByText("Tech Trivia Point")).toBeVisible();
  await tabs.getByRole("tab", { name: /^Make/ }).click();
  await expect(page.getByText("Origami Wonderland")).toBeVisible();
  await expect(page.getByText("Tech Trivia Point")).toHaveCount(0);
});

test("the wallet still opens with no network", async ({ page, context }) => {
  await page.goto("/epoch"); await page.evaluate(() => localStorage.clear());
  await register(page, "ada", "Ada Lovelace");
  await page.reload(); await page.waitForTimeout(1500); // let the service worker take control and cache
  await page.reload(); await page.waitForTimeout(1000);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Hi, Ada/ })).toBeVisible();
  await page.goto("/epoch/booths");
  await expect(page.getByText("Recharge points").first()).toBeVisible();
  await context.setOffline(false);
});
