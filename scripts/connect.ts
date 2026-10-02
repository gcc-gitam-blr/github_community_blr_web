/* npm run connect — switches on the real backend in one go:
     1. Supabase: checks the keys and creates every table (sign-ups, messages, feedback, Epoch coins)
     2. Gmail:    checks the App Password by sending you a test email
     3. Saves everything to .env.local, and (optional) to your Vercel project
   npm run connect -- admin <github-handle>   makes someone an organiser (after they've signed in once)
   Press Enter to keep a value shown in [brackets]. Nothing is sent anywhere except Supabase, Gmail and Vercel. */
import fs from "node:fs";
import { createInterface } from "node:readline/promises";
import { applySchema, checkEmail, checkSupabase, makeAdmin, mergeEnv, newSecret, pushVercel, type Check } from "./connect-lib";

const ENV = ".env.local";
const env: Record<string, string> = Object.fromEntries(
  (fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "").split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m![1], m![2].replace(/^"|"$/g, "")]),
);
const rl = createInterface({ input: process.stdin, output: process.stdout });
let finished = false;
rl.on("close", () => { if (!finished) { console.log("\n\n  Stopped. Run npm run connect again any time — it remembers what you entered."); process.exit(0); } });
const hide = (v: string) => (v.length > 8 ? v.slice(0, 4) + "…" + v.slice(-2) : v ? "••••" : "");
const ask = async (q: string, cur = "", secret = false) => (await rl.question(`  ${q}${cur ? ` [${secret ? hide(cur) : cur}]` : ""}: `)).trim() || cur;
const say = (s = "") => console.log(s);
const report = (what: string, r: Check) => { say(r.ok ? `  ✓ ${what}` : `  ✗ ${what}: ${r.error}`); return r.ok; };
const save = (vars: Record<string, string>) => { Object.assign(env, vars); fs.writeFileSync(ENV, mergeEnv(fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "", vars)); };

async function main() {
  if (process.argv[2] === "admin") {
    const handle = process.argv[3] || (await ask("GitHub username to make an organiser"));
    const db = env.SUPABASE_DB_URL || (await ask("Database connection string (Supabase → Connect → Session pooler)", "", true));
    report(`@${handle} is now an admin`, await makeAdmin(db, handle));
    return;
  }

  say("\nConnect the club website — about 5 minutes. Have two tabs open: supabase.com and myaccount.google.com.\n");

  say("1/3  Database (Supabase, free) — stores sign-ups, Get involved messages, feedback and Epoch coins.");
  say("     New project at supabase.com/dashboard → then Project Settings → API.");
  let url = "", key = "";
  for (;;) {
    url = (await ask("Project URL", env.NEXT_PUBLIC_SUPABASE_URL)).replace(/\/$/, "");
    key = await ask("anon public key", env.NEXT_PUBLIC_SUPABASE_ANON_KEY, true);
    if (report("Supabase keys work", await checkSupabase(url, key))) break;
  }
  save({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key });
  say("     Now the tables. Click Connect (top of the dashboard) → Session pooler → copy the URI, and put your database password in it.");
  for (;;) {
    const db = await ask("Connection string (postgresql://…)", env.SUPABASE_DB_URL, true);
    if (report("tables created (safe to run again later)", await applySchema(db, fs.readFileSync("supabase/schema.sql", "utf8")))) { save({ SUPABASE_DB_URL: db }); break; }
  }

  say("\n2/3  Email (Gmail) — welcome emails, message notifications to the club inbox, broadcasts.");
  say("     Turn on 2-Step Verification, then make an App Password at myaccount.google.com/apppasswords.");
  let mail: Record<string, string> = {};
  for (;;) {
    const user = await ask("Club Gmail address", env.SMTP_USER);
    const pass = (await ask("App Password (16 letters)", env.SMTP_PASS, true)).replace(/\s+/g, "");
    const from = `GitHub Community Club BLR <${user}>`;
    say(`     Sending a test email to ${user}…`);
    if (report("email works — check that inbox", await checkEmail({ host: "smtp.gmail.com", port: 465, user, pass }, from, user))) {
      mail = { EMAIL_FROM: from, SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", SMTP_USER: user, SMTP_PASS: pass, EMAIL_SECRET: env.EMAIL_SECRET || newSecret() };
      save(mail); break;
    }
  }

  say(`\n     Saved to ${ENV} (git ignores it). \`npm run dev\` now uses the real database and email.`);

  say("\n3/3  The live site (Vercel). Make a token at vercel.com/account/tokens — or press Enter to skip and paste the values in the Vercel dashboard yourself.");
  const token = await ask("Vercel token");
  const live = { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key, ...mail };
  if (token) {
    const project = await ask("Vercel project name", env.VERCEL_PROJECT || "github-community-blr");
    const team = await ask("Team ID (only if the project is under a team, from Team Settings)", env.VERCEL_TEAM_ID);
    if (report("saved on Vercel (production + preview)", await pushVercel(token, project, live, { team: team || undefined }))) {
      save({ VERCEL_PROJECT: project, ...(team ? { VERCEL_TEAM_ID: team } : {}) });
      say("     Redeploy once so the site picks them up: Vercel → Deployments → ⋯ → Redeploy (or push any commit).");
    }
  } else {
    say("     Add these in Vercel → Project → Settings → Environment Variables:");
    for (const [k, v] of Object.entries(live)) say(`       ${k} = ${/PASS|SECRET/.test(k) ? hide(v) + "  (full value is in .env.local)" : v}`);
  }

  say("\nLast, for Epoch sign-in only: Supabase → Authentication → Sign In / Providers → GitHub → on.");
  say("  It asks for a GitHub OAuth app: github.com/settings/developers → New OAuth App, callback URL:");
  say(`  ${url}/auth/v1/callback`);
  say("  Then sign in once at /epoch/register and run:  npm run connect -- admin <your-github-handle>\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { finished = true; rl.close(); });
