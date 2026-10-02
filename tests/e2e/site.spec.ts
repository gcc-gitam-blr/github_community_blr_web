import { expect, test } from "@playwright/test";

test.describe("club site", () => {
  test("home page tells people what the club is", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Code.");
    await expect(page.getByRole("heading", { name: /What is GitHub/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /A community that/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Join the club/ }).first()).toBeVisible();
  });

  test("the join form guides people and refuses an incomplete sign-up", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#join form");
    await form.scrollIntoViewIfNeeded();
    await form.getByRole("button", { name: /Merge pull request/ }).click();
    await expect(form.getByText(/complete all three steps/)).toBeVisible();
    await form.getByPlaceholder("your-github-handle").fill("-bad-");
    await expect(form.getByText(/doesn't look like a GitHub username/)).toBeVisible();
    await expect(form.getByText(/3 of 3 checks pending/)).toBeVisible();
  });

  test("every footer link on the home page leads somewhere that exists", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.locator("footer a[href^='/']").evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!.split("#")[0] || "/"))]);
    expect(hrefs.length).toBeGreaterThan(5);
    for (const h of hrefs) expect((await request.get(h)).status(), `GET ${h}`).toBeLessThan(400);
  });

  test("an event page works like a release page, with a calendar file", async ({ page, request }) => {
    await page.goto("/events/git-merge-26");
    await expect(page.getByRole("heading", { level: 1, name: "GIT Merge 26" })).toBeVisible();
    await expect(page.getByText("v2026.10.12")).toBeVisible();
    const ics = await request.get("/events/git-merge-26/event.ics");
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain("SUMMARY:GIT Merge 26");
  });

  test("Learn GitHub is on 7 October, matching Luma", async ({ request }) => {
    const ics = await (await request.get("/events/learn-github-and-make-your-first-contribution/event.ics")).text();
    expect(ics).toContain("DTSTART;VALUE=DATE:20261007");
  });

  test("the calendar file lists all six events", async ({ request }) => {
    const ics = await (await request.get("/calendar.ics")).text();
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(6);
  });

  test("the cheat sheet searches and finds commands", async ({ page }) => {
    await page.goto("/learn");
    const cmds = page.locator("#cheat ~ div code");
    expect(await cmds.count()).toBeGreaterThan(20);
    await page.getByPlaceholder(/Search/).fill("stash");
    await expect(cmds).toHaveCount(2);
    await page.getByPlaceholder(/Search/).fill("zzzzz");
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
  });

  test("Get involved preselects the kind from the link and validates", async ({ page }) => {
    await page.goto("/get-involved?kind=apply");
    await expect(page.getByLabel(/Join the core team/)).toBeChecked();
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("form [role=alert]")).toContainText(/name/i);
  });

  test("privacy, unsubscribe and a missing page all render sensibly", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Privacy");
    await page.goto("/unsubscribe?e=a%40b.in&t=wrong");
    await expect(page.getByRole("heading", { name: /doesn't work/ })).toBeVisible();
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/this branch doesn't exist/)).toBeVisible();
  });

  test("security headers are set", async ({ request }) => {
    const h = (await request.get("/")).headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });

  test("no page breaks the Content-Security-Policy or throws a script error", async ({ page }) => {
    const bad: string[] = [];
    page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) bad.push(m.text().slice(0, 140)); });
    page.on("pageerror", (e) => bad.push("script error: " + e.message.slice(0, 140)));
    for (const p of ["/", "/learn", "/contribute", "/get-involved", "/privacy", "/events/git-merge-26", "/epoch", "/epoch/booths", "/epoch/register", "/epoch/leaderboard"]) {
      await page.goto(p); await page.waitForTimeout(700);
    }
    await page.goto("/"); await page.locator("#join").getByPlaceholder("your-github-handle").fill("octocat"); await page.waitForTimeout(2000); // GitHub lookup + avatar
    expect(bad).toEqual([]);
  });

  test("API routes refuse bad requests instead of crashing", async ({ request }) => {
    expect((await request.post("/api/join", { data: { handle: "-x-", email: "no", firstEvent: "x" } })).status()).toBe(422);
    expect((await request.post("/api/contact", { data: { kind: "apply" } })).status()).toBe(422);
    expect((await request.post("/api/feedback", { data: { event: "2026-10-07", rating: 9 } })).status()).toBe(422);
    expect((await request.post("/api/broadcast", { data: {} })).status()).toBeGreaterThanOrEqual(400);
  });
});

test("with no inbox switched on, Get involved hands the message to Instagram instead of losing it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/get-involved");
  await page.getByLabel("Your name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@gitam.in");
  await page.locator("textarea").fill("We'd love to run a workshop on Git internals.");
  await page.waitForTimeout(3500); // humans take a few seconds; the spam check knows that
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("heading", { name: /send it to us on Instagram/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Copy & open Instagram/ })).toHaveAttribute("href", "https://ig.me/m/github.gitamblr");
  await page.getByRole("button", { name: "Copy only" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Git internals");
});

test("updates: the list, a post, the home page and the RSS feed agree", async ({ page, request }) => {
  await page.goto("/updates");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("What's new");
  await page.getByRole("link", { name: /Start here: Learn GitHub/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Start here");
  await expect(page.getByRole("link", { name: /RSVP on Luma/ })).toHaveAttribute("href", "https://luma.com/exkd0eax");
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Start here: Learn GitHub/ })).toBeVisible();
  const rss = await request.get("/updates/feed.xml");
  expect(rss.headers()["content-type"]).toContain("rss+xml");
  const xml = await rss.text();
  expect((xml.match(/<item>/g) ?? []).length).toBeGreaterThanOrEqual(4);
  expect(xml).not.toMatch(/href="\/[^/]/); // links inside the feed are absolute
});

test("every link inside the update posts leads somewhere that exists", async ({ page, request }) => {
  await page.goto("/updates");
  const posts = await page.locator("main ol a[href^='/updates/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
  for (const p of posts) {
    await page.goto(p);
    const links = await page.locator(".post a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!.split("#")[0] || "/"));
    for (const h of links) expect((await request.get(h)).status(), `${p} → ${h}`).toBeLessThan(400);
  }
});

test("stickers on the laptop lid can be dragged, rubber-band at the edges, and settle on the lid", async ({ page }) => {
  await page.goto("/");
  const lid = page.locator("figure.reveal-group").first();
  await lid.scrollIntoViewIfNeeded(); await expect(lid).toHaveClass(/\bin\b/);
  const sticker = lid.locator(".pop").first(); await page.waitForTimeout(1200);
  const a = (await sticker.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + 2000, a.y + 2000, { steps: 6 });
  const box = (await lid.locator("> div").first().boundingBox())!, held = (await sticker.boundingBox())!;
  expect(held.x + held.width).toBeGreaterThan(box.x + box.width); // dragged past the edge it gives a little…
  expect(held.x - a.x).toBeLessThan(1000);                       // …but resists: far less than the 2000px pulled
  await page.mouse.up(); await page.waitForTimeout(700);           // then springs back inside
  const b = (await sticker.boundingBox())!;
  expect(b.x).toBeGreaterThan(a.x + 50);
  expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
  expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height + 1);
});

test("GitHub Changelog headlines link only to GitHub's own changelog (and hide if the feed is down)", async ({ page }) => {
  for (const path of ["/", "/updates"]) {
    await page.goto(path);
    const links = await page.locator("#gh-changelog ~ * a, [aria-labelledby=gh-changelog] ol a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const h of links) expect(h, path).toMatch(/^https:\/\/github\.blog\/changelog\//);
  }
});

test("admin and certificates without a database: clear messages, no crashes", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page.getByText(/database isn.t connected/)).toBeVisible();
  expect((await page.goto("/certificates/00000000-0000-0000-0000-000000000000"))?.status()).toBe(404);
  expect((await request.post("/api/certificates", { data: { event: "2026-10-07" } })).status()).toBeGreaterThanOrEqual(400);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
});

test("the header is a commit graph: history behind HEAD, the rest ahead", async ({ page }) => {
  await page.goto("/updates");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Updates" })).toHaveAttribute("aria-current", "page");
  const states = await nav.locator("li.commit").evaluateAll((ls) => ls.map((l) => [...l.classList].find((c) => c.startsWith("is-"))));
  expect(states).toEqual(["is-past", "is-past", "is-head", "is-ahead", "is-ahead"]);
  await page.goto("/");
  await page.evaluate(() => document.getElementById("events")!.scrollIntoView());
  await expect(nav.getByRole("link", { name: "Events" })).toHaveAttribute("aria-current", "page"); // HEAD follows the scroll
});

test("site search: / opens it, results are keyboard-driven, Enter goes there, Esc closes", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("/");
  const box = page.getByRole("combobox", { name: "Search the site" });
  await expect(box).toBeFocused();
  await box.fill("stash");
  await expect(page.getByRole("dialog").getByRole("option").first()).toContainText("git stash");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/learn\?q=git%20stash/);
  await expect(page.locator("#cheat ~ div code")).toHaveCount(2); // the cheat sheet opens already filtered
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search the site" }).fill("december");
  await expect(page.getByRole("option", { name: /Epoch is coming in December/ })).toBeVisible(); // update posts come from /search.json
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});



test("the team: mentors, the five leads, everyone else, and their crew roles", async ({ page, request }) => {
  await page.goto("/");
  const team = page.locator("#team");
  await team.scrollIntoViewIfNeeded();
  for (const line of ["Mentor · Tech & Design", "Former President, 2024-25", "Former Inclusion & Events Head", "Former President, 2025-26", "Former Vice-President, 2025-26"]) await expect(team.getByText(line)).toBeVisible();
  for (const [name, role] of [["Monisha S", "President"], ["Dhigveerraju G", "Vice President"], ["Supriya K S", "Secretary"], ["T Sai Ruchitha", "Design Lead"], ["Chandrika", "External Relations Head"]]) {
    await expect(team.getByRole("heading", { name })).toBeVisible();
    await expect(team.getByText(role, { exact: true })).toBeVisible();
  }
  for (const name of ["Geethika", "Aravind K", "Vishnu Teja", "Venkata Madhu K", "Bhavana", "Niharika", "Apsara", "Lokesh", "Manogna"]) await expect(team.getByRole("heading", { name })).toBeVisible();
  // the crew roles, as assigned
  for (const [label, n] of [["Git Custodian I", 2], ["Code Gatekeeper I", 2], ["Pipeline Architect I", 2], ["Secrets & Security Officer I", 2], ["Issue Alchemist I", 2], ["Stack Explorer I", 1]] as const) await expect(team.getByText(label, { exact: true })).toHaveCount(n);
  await team.getByText("How our tech roles work").click();
  await expect(team.getByText(/merge conflicts newer members run into/)).toBeVisible();
  await expect(team.getByRole("heading", { name: /Contributors/ })).toContainText("9");
  for (const src of ["/team/monisha-s.webp", "/team/supriya-k-s-sm.webp", "/team/greeshmitha.webp", "/team/raja-sree-sm.webp", "/brand/club-mark.png"]) expect((await request.get(src)).status(), src).toBe(200);
});

test("the Epoch link and search open full-screen, not inside the glass header", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search the site" }).click();
  const box = await page.getByRole("dialog", { name: "Search the site" }).locator("xpath=..").boundingBox();
  expect(box!.height).toBeGreaterThan(500); // the scrim covers the page, not just the header
  await page.keyboard.press("Escape");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Epoch/ }).click();
  const wipe = await page.locator(".epoch-wipe").boundingBox();
  expect(wipe!.height).toBeGreaterThan(500);
  await page.waitForURL("**/epoch");
});
