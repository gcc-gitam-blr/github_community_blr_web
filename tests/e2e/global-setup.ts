import fs from "node:fs";
import path from "node:path";

/* Safety net: refuse to run the browser tests against a build that talks to the real Supabase project.
   (Tests fill in forms; with real settings they would save rows and send real email.) */
export default function globalSetup() {
  const env = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) return;
  const dir = ".next/static/chunks", files: string[] = [];
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(path.join(d, f.name));
      else if (f.name.endsWith(".js")) files.push(path.join(d, f.name));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  if (files.some((f) => fs.readFileSync(f, "utf8").includes(url)))
    throw new Error("This build uses your real Supabase project (from .env.local). Run `npm run build:test` before the browser tests — it builds in demo mode.");
}
