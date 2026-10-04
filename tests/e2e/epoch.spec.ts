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

test("organisers: a volunteer runs one booth, reverses a scan once, and the admin sees it in the audit log", async ({ page }) => {
  test.setTimeout(120_000); // a whole volunteer + admin session: about 30 s alone, slower when the suite runs in parallel
  await page.goto("/epoch"); await page.evaluate(() => localStorage.clear());
  await register(page, "ada", "Ada Lovelace"); const adaId = await userId(page, "ada");
  await signOut(page); await register(page, "vol", "Val Volunteer");
  await signOut(page); await register(page, "org", "Organiser");
  await page.goto("/epoch/admin");
  await page.getByPlaceholder("organiser code").fill("epoch-admin"); await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("link", { name: "Organiser guide" })).toBeVisible();

  // the admin adds a volunteer and puts them on the VR booth
  await page.getByPlaceholder("@github-username").fill("vol"); await page.getByRole("button", { name: "Add a volunteer" }).click();
  await expect(page.getByText("@vol is now a volunteer")).toBeVisible();
  await page.getByLabel("Booth for @vol").selectOption("vr");
  await expect(page.getByText("@vol now runs Virtual Reality Merge Zone")).toBeVisible();

  // find Ada by name at the desk, check her in
  await page.getByLabel(/Find them by name/).fill("lovel");
  await page.getByRole("button", { name: /Ada Lovelace/ }).click();
  await page.waitForURL(/\/epoch\/scan\?u=/);
  await page.getByRole("button", { name: /Verify ticket/ }).click();
  await expect(page.getByText("+398")).toBeVisible();

  // the volunteer charges Ada at VR, can't scan another booth, and reverses the charge once
  await signOut(page); await register(page, "vol", "Val Volunteer");
  await scan(page, `epoch:u:${adaId}`);
  await expect(page.getByText("Your booth")).toBeVisible();
  await page.getByRole("button", { name: /Charge 40/ }).click();
  await expect(page.getByText("New balance 358")).toBeVisible();
  await scan(page, `epoch:u:${adaId}`);
  await page.getByRole("button", { name: "Reverse", exact: true }).click();
  await page.getByLabel("Why it's being reversed").fill("scanned twice");
  await page.getByRole("button", { name: /Reverse −40/ }).click();
  await expect(page.getByText("New balance 398")).toBeVisible();
  await scan(page, `epoch:u:${adaId}`);
  await expect(page.getByText("Reversed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reverse", exact: true })).toHaveCount(0); // never twice

  // the admin's audit log has it all, and filters
  await signOut(page); await register(page, "org", "Organiser");
  await page.goto("/epoch/admin");
  const log = page.getByRole("region", { name: "Audit log" });
  await expect(log.getByText("scanned twice")).toBeVisible();
  await log.getByRole("button", { name: "Reversals" }).click();
  await expect(log.locator("li")).toHaveCount(1);
  await log.getByRole("button", { name: "All" }).click();
  await log.getByPlaceholder("@someone").fill("vol");
  await expect(log.getByText(/moved/)).toBeVisible();

  // Ada's wallet: each line opens a receipt with the balance after it; the filter splits spent and earned
  await signOut(page); await register(page, "ada", "Ada Lovelace");
  await page.getByRole("button", { name: /^Virtual Reality Merge Zone/ }).click(); // the charge, not its reversal
  const receipt = page.getByRole("dialog");
  await expect(receipt.getByText("Balance after")).toBeVisible();
  await expect(receipt.getByText(/^EPC-[0-9A-F]{6}$/)).toBeVisible();
  await expect(receipt.getByText(/Reversed by an organiser/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(receipt).toHaveCount(0);
  await page.getByRole("button", { name: "spent" }).click();
  await expect(page.getByRole("button", { name: /Check-in/ })).toHaveCount(0);
  await page.getByRole("button", { name: "earned" }).click();
  await expect(page.getByRole("button", { name: /Check-in/ })).toBeVisible();
});

test("the guides are one printable page each and link to each other", async ({ page }) => {
  await page.goto("/epoch/guide");
  await expect(page.getByRole("heading", { level: 1, name: "How Epoch works." })).toBeVisible();
  await expect(page.getByText(/no online payment/)).toBeVisible();
  await page.getByRole("link", { name: "Organiser guide" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Running Epoch." })).toBeVisible();
  for (const h of ["Desk check-in", "Cash at the desk", "Reversing a mistake", "The kiosk", "Who to call"]) await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
  // printed: one A4 page, with no site chrome
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true });
  expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  await page.goto("/epoch/guide");
  const pdf2 = await page.pdf({ format: "A4", preferCSSPageSize: true });
  expect((pdf2.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
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
