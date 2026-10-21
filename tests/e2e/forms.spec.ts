import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { tokenFor } from "../../lib/email/token";

/* Every public form, end to end: the page, the API route and the real SQL functions (supabase/schema.sql, running in
   tests/e2e/fake-supabase.ts), and back. Each test checks what the person sees AND that the row was really saved, so a
   form that says "done" without saving fails here. Runs as the "forms" project (playwright.config.ts). */
const DB = "http://127.0.0.1:54329", SECRET = "forms-test-secret"; // the same secret the "forms" server runs with
const sql = async <T = Record<string, unknown>>(request: APIRequestContext, q: string, params: unknown[] = []) =>
  (await (await request.post(`${DB}/__sql`, { data: { q, params } })).json()) as T[];

test.beforeEach(async ({ request, page }) => {
  await request.post(`${DB}/__reset`); // empty tables and rate limits, so every test starts the same
  await page.route("https://api.github.com/users/**", (r) => r.fulfill({ json: { login: "ada-l", name: "Ada Lovelace", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" } }));
});

async function joinIn(page: Page, scope: ReturnType<Page["locator"]>, button: RegExp, name = "Ada Lovelace", email = "ada@gitam.in") {
  await scope.getByPlaceholder("Your name").fill(name);
  await scope.getByPlaceholder("you@gitam.in").fill(email);
  await scope.getByRole("button", { name: button }).click(); // straight away, as when the browser fills both fields
}

test("joining from the hero saves the sign-up, says you're in, and adds the GitHub username and first event", async ({ page, request }) => {
  await page.goto("/");
  const hero = page.locator("#top");
  await expect(hero.locator('input[name="gcc-hp-x"]')).toBeHidden(); // the bot trap is never displayed, so no browser or password manager fills it
  await joinIn(page, hero, /^Join the club$/);
  await expect(hero.getByText("You're in, Ada.")).toBeVisible();
  await expect(hero.getByText("That didn't go through")).toHaveCount(0);
  expect(await sql(request, "select name, email from join_requests")).toEqual([{ name: "Ada Lovelace", email: "ada@gitam.in" }]);

  await hero.getByPlaceholder("your-github-username").fill("ada-l");
  await expect(hero.getByText("Found you, Ada Lovelace.")).toBeVisible();
  await hero.locator("fieldset label").first().click();
  await hero.getByRole("button", { name: "Save" }).click();
  await expect(hero.getByPlaceholder("your-github-username")).toHaveCount(0);
  const [row] = await sql<{ handle: string; first_event: string | null }>(request, "select handle, first_event from join_requests");
  expect(row.handle).toBe("ada-l");
  expect(row.first_event).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("pressing Enter the moment the fields are filled (autofill speed) still joins", async ({ page, request }) => {
  await page.goto("/");
  const hero = page.locator("#top");
  await hero.getByPlaceholder("Your name").fill("Grace Hopper");
  await hero.getByPlaceholder("you@gitam.in").fill("grace@gitam.in");
  await hero.getByPlaceholder("you@gitam.in").press("Enter");
  await expect(hero.getByText("You're in, Grace.")).toBeVisible();
  expect((await sql(request, "select email from join_requests")).length).toBe(1);
});

test("joining again with the same email is welcomed, not an error, and stays one sign-up", async ({ page, request }) => {
  await page.goto("/");
  await joinIn(page, page.locator("#top"), /^Join the club$/);
  await expect(page.locator("#top").getByText("You're in, Ada.")).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await joinIn(page, page.locator("#top"), /^Join the club$/, "Ada L", "ADA@gitam.in");
  await expect(page.locator("#top").getByText("You're in, Ada.")).toBeVisible();
  expect(await sql(request, "select name from join_requests")).toEqual([{ name: "Ada Lovelace" }]);
});

test("the pull-request card at the bottom of the home page joins too", async ({ page, request }) => {
  await page.goto("/#join");
  await joinIn(page, page.locator("#join"), /Join the club/, "Linus T", "linus@gitam.in");
  await expect(page.locator("#join").getByText("You're in, Linus.")).toBeVisible();
  expect(await sql(request, "select email from join_requests")).toEqual([{ email: "linus@gitam.in" }]);
});

test("/join joins, and the welcome email's link adds the username later; a wrong link is refused", async ({ page, request }) => {
  await page.goto("/join");
  await joinIn(page, page.locator("main"), /Join the club/, "Margaret H", "margaret@gitam.in");
  await expect(page.locator("main").getByText("You're in, Margaret.")).toBeVisible();

  // a different browser, from the welcome email's link
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/join?e=${encodeURIComponent("margaret@gitam.in")}&t=${tokenFor("margaret@gitam.in", SECRET)}`);
  await page.getByPlaceholder("your-github-username").fill("ada-l");
  await expect(page.getByText("Found you")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await sql<{ handle: string }>(request, "select handle from join_requests"))[0]?.handle).toBe("ada-l");

  await page.evaluate(() => localStorage.clear());
  await page.goto(`/join?e=${encodeURIComponent("margaret@gitam.in")}&t=${"0".repeat(32)}`);
  await page.getByPlaceholder("your-github-username").fill("someone-else");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/That link has expired/)).toBeVisible();
});

test("the join form at the end of an event page saves a sign-up", async ({ page, request }) => {
  await page.goto("/events/git-merge-26");
  const strip = page.getByRole("region", { name: "Join the club" });
  await joinIn(page, strip, /^Join the club$/, "Ken T", "ken@gitam.in");
  await expect(page.getByText("You're in, Ken.")).toBeVisible();
  expect(await sql(request, "select email from join_requests")).toEqual([{ email: "ken@gitam.in" }]);
});

test("a message from Get involved is saved; one sent too fast says so and goes through when sent again", async ({ page, request }) => {
  await page.goto("/get-involved");
  await page.getByLabel("Your name").fill("Ada Lovelace");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("ada@gitam.in");
  await page.locator("textarea").fill("I'd like to run a session on writing good commit messages.");
  await page.getByRole("button", { name: /Send/ }).click(); // instantly: a script's speed
  await expect(page.getByText("That was quick. Check it over, then send it again.")).toBeVisible();
  await page.waitForTimeout(2_600);
  await page.getByRole("button", { name: /Send/ }).click();
  await expect(page.getByText("Message sent. Thank you!")).toBeVisible();
  expect(await sql(request, "select name, email from messages")).toEqual([{ name: "Ada Lovelace", email: "ada@gitam.in" }]);
});

test("feedback on an event is saved", async ({ page, request }) => {
  await page.goto("/events/learn-github-and-make-your-first-contribution");
  const form = page.locator("#feedback");
  await form.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_300); // a person reads before rating
  await form.getByLabel("4 stars").check({ force: true });
  await form.getByRole("button", { name: /Send/ }).click();
  await expect(page.getByText("Thank you!")).toBeVisible();
  expect(await sql(request, "select event, rating from event_feedback")).toEqual([{ event: "2026-10-12", rating: 4 }]);
});

test("asking to hear when the Epoch dates are out saves the address", async ({ page, request }) => {
  await page.goto("/");
  const box = page.locator("form").filter({ has: page.getByRole("button", { name: "Email me" }) }).first();
  await box.getByPlaceholder("you@gitam.in").fill("alan@gitam.in");
  await box.getByRole("button", { name: "Email me" }).click();
  await expect(page.getByText(/Watching\. We'll email you/)).toBeVisible();
  expect(await sql(request, "select email from epoch_interest")).toEqual([{ email: "alan@gitam.in" }]);
});

test("an unsubscribe link with a valid key unsubscribes; a changed one doesn't", async ({ page, request }) => {
  await sql(request, "insert into join_requests (name, email) values ('Ada Lovelace', 'ada@gitam.in')");
  await page.goto(`/unsubscribe?e=${encodeURIComponent("ada@gitam.in")}&t=${tokenFor("ada@gitam.in", SECRET)}`);
  await page.getByRole("button", { name: "Yes, unsubscribe me" }).click();
  await expect(page.getByRole("heading", { name: "You're unsubscribed." })).toBeVisible();
  expect(await sql(request, "select unsubscribed from join_requests")).toEqual([{ unsubscribed: true }]);
  await page.goto(`/unsubscribe?e=${encodeURIComponent("ada@gitam.in")}&t=${"0".repeat(32)}`);
  await expect(page.getByRole("heading", { name: "That link doesn't work." })).toBeVisible();
});

test("applying to the core team while a round is open saves the application", async ({ page, request }) => {
  await sql(request, "insert into recruitment_campaigns (name, year, status, opens_on, closes_on) values ('Core team, odd semester', '2026-27', 'open', today_ist() - 1, today_ist() + 10)");
  await page.goto("/apply");
  await expect(page.getByText(/Core team, odd semester/)).toBeVisible();
  await page.getByLabel("Your name").fill("Ada Lovelace");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("ada@gitam.in");
  await page.getByLabel("GitHub username").fill("ada-l");
  await page.locator("textarea").first().fill("I want to help run the beginner sessions and review first pull requests.");
  await page.waitForTimeout(2_600);
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText("Application sent. Thank you!")).toBeVisible();
  expect(await sql(request, "select name, handle, status from applications")).toEqual([{ name: "Ada Lovelace", handle: "ada-l", status: "submitted" }]);
});
