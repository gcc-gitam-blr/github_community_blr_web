/* npm run build:test — builds the site for the browser tests WITHOUT your .env.local, so they run in demo mode
   and can never write to the real database or send real email. .env.local is set aside for the build and always put back.
   (The test server itself runs with NODE_ENV=test, which makes Next.js skip .env.local at runtime.) */
import { execSync } from "node:child_process";
import fs from "node:fs";

const ENV = ".env.local", AWAY = ".env.during-test-build.local"; // the temporary name still matches .gitignore (.env*.local)
if (fs.existsSync(AWAY) && !fs.existsSync(ENV)) fs.renameSync(AWAY, ENV); // a previous run was interrupted
const had = fs.existsSync(ENV);
const restore = () => { if (had && fs.existsSync(AWAY)) fs.renameSync(AWAY, ENV); };
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { restore(); process.exit(1); });

if (had) fs.renameSync(ENV, AWAY);
fs.rmSync(".next/cache", { recursive: true, force: true }); // never reuse modules compiled with the real settings
try { execSync("npx next build --webpack", { stdio: "inherit" }); }
finally { restore(); }
