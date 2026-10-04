/* "Tell me when the Epoch dates are out": the form's checks and the route without a database. */
import { validateInterest } from "../lib/interest";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

ok("a normal email passes", validateInterest({ email: " grace@gitam.in " }) === null);
ok("a broken email is explained", validateInterest({ email: "grace@" }) === "That email doesn't look right.");
ok("the hidden honeypot field marks a bot", validateInterest({ email: "grace@gitam.in", website: "spam.example" }) === "spam");
ok("an address the browser autofills in an instant still counts as a person", validateInterest({ email: "grace@gitam.in", elapsedMs: 0 } as never) === null);

(async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { POST } = await import("../app/api/epoch-interest/route");
  const post = (body: unknown, ip = "1.1.1.1") => POST(new Request("http://x/api/epoch-interest", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) }));
  ok("a bad email is refused", (await post({ email: "nope" })).status === 422);
  const bot = await post({ email: "a@b.in", website: "x" });
  ok("a bot is told it worked (and nothing is saved)", bot.status === 200 && (await bot.json()).ok === true);
  const off = await post({ email: "grace@gitam.in" }), j = await off.json();
  ok("without a database it says the list isn't switched on, instead of pretending", off.status === 503 && j.off === true);
  for (let i = 0; i < 5; i++) await post({ email: "grace@gitam.in" }, "9.9.9.9");
  ok("more than five tries in ten minutes from one place are slowed down", (await post({ email: "grace@gitam.in" }, "9.9.9.9")).status === 429);

  if (fails) { console.log(`${fails} interest check(s) failed`); process.exit(1); }
  console.log("all interest checks passed");
})();
