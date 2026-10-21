/* Epoch's "Email me a code" (lib/auth/email-code.ts and its two emails), against a fake Supabase admin API. */
import { emailSignInCode } from "../lib/auth/email-code";
import type { AuthAdmin } from "../lib/auth/github-login";
import { organiserSignInEmail, signInCodeEmail } from "../lib/email/templates";
import { atHandle } from "../lib/handle";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

(async () => {
  const users = new Map<string, { id: string; meta: object; app?: object }>();
  let n = 0;
  const admin: AuthAdmin = {
    async createUser({ email, user_metadata, app_metadata }) {
      if (users.has(email)) return { data: { user: null }, error: { message: "A user with this email address has already been registered", code: "email_exists", status: 422 } };
      const u = { id: `u${users.size + 1}`, meta: user_metadata, app: app_metadata }; users.set(email, u); return { data: { user: { id: u.id } }, error: null };
    },
    async generateLink({ email }) { const u = users.get(email); n++; return u ? { data: { user: { id: u.id }, properties: { hashed_token: `h${n}`, email_otp: String(100000 + n) } }, error: null } : { data: { user: null, properties: null }, error: { message: "User not found" } }; },
    async updateUserById() { return { error: null }; },
  };
  const organisers = new Set<string>();
  const isOrganiser = async (id: string) => organisers.has(id);

  ok("a bad address is refused before anything is made", !(await emailSignInCode(admin, "ada@", isOrganiser)).ok && users.size === 0);
  const first = await emailSignInCode(admin, "  Ada@GITAM.in ", isOrganiser);
  ok("a new address gets an account and a code", first.ok && first.kind === "code" && /^\d{6}$/.test(first.code) && users.has("ada@gitam.in"));
  const made = users.get("ada@gitam.in")!;
  ok("…with no GitHub username anywhere, so the database gives it a ~ handle", JSON.stringify(made.meta) === "{}" && made.app === undefined);
  const again = await emailSignInCode(admin, "ada@gitam.in", isOrganiser);
  ok("the same address again reuses the account with a fresh code", again.ok && again.kind === "code" && first.ok && first.kind === "code" && again.userId === first.userId && again.code !== first.code && users.size === 1);

  organisers.add(made.id);
  const org = await emailSignInCode(admin, "ada@gitam.in", isOrganiser);
  ok("an address with organiser access gets no code", org.ok && org.kind === "organiser" && !("code" in org));
  const unsure = await emailSignInCode(admin, "ada@gitam.in", async () => null);
  ok("if organiser access can't be checked, no code is made either", !unsure.ok);
  const broken = await emailSignInCode({ ...admin, generateLink: async () => ({ data: { user: null, properties: null }, error: { message: "down" } }) }, "bo@gitam.in", isOrganiser);
  ok("a Supabase failure is a friendly error", !broken.ok && /try again/.test(broken.error));
  const failedCreate = await emailSignInCode({ ...admin, createUser: async () => ({ data: { user: null }, error: { message: "Database error" } }) }, "cy@gitam.in", isOrganiser);
  ok("…and so is a failure creating the account", !failedCreate.ok && /try again/.test(failedCreate.error));

  const m = signInCodeEmail({ code: "123456", site: "https://club.test" });
  ok("the code email puts the code in the subject, so a phone's notification shows it", m.subject.startsWith("123456"));
  ok("…and in the email, plain and HTML", m.html.includes("123456") && m.text.includes("123456"));
  ok("…and says what to do if you didn't ask for it", /didn't ask/.test(m.text));
  const o = organiserSignInEmail({ site: "https://club.test/" });
  ok("an organiser is told to use GitHub, with a link, and gets no code", /GitHub/.test(o.subject) && o.html.includes("https://club.test/epoch/register") && !/\d{6}/.test(o.text));

  ok("a GitHub username shows as @name; an email-code account's ~ handle shows as nothing", atHandle("ada-l") === "@ada-l" && atHandle("~ada") === "" && atHandle("") === "" && atHandle(null) === "");

  if (fails) { console.log(`${fails} email-code check(s) failed`); process.exit(1); }
  console.log("all email-code checks passed");
})();
