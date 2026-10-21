// Runs every tests/*.test.ts, one after another, and keeps going past a failure, so one broken
// check can't hide the rest. Prints which files failed at the end and exits 1 if any did.
// A new test file is picked up by itself: no list to keep up to date.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const only = process.argv.slice(2);
const files = readdirSync("tests")
  .filter((f) => f.endsWith(".test.ts"))
  .filter((f) => only.length === 0 || only.some((o) => f.includes(o)))
  .sort()
  .map((f) => `tests/${f}`);

const failed = [];
for (const file of files) {
  const run = spawnSync(process.execPath, ["--import", "tsx", file], { stdio: "inherit" });
  if (run.status !== 0) failed.push(file);
}

console.log(`\n${files.length - failed.length} of ${files.length} test files passed.`);
if (failed.length) {
  console.log(`Failed:\n${failed.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
