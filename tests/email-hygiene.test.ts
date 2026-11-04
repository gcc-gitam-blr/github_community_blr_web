/* Every email the club sends is built to look like what it is, a message from people, not a mass mailing:
   a complete page, a plain-text copy, no outside stylesheets or scripts, and links that show where they go. */
import { broadcastEmail, certificateEmail, welcomeEmail, digestEmail } from "../lib/email/templates";
import { lessonEmail } from "../lib/email/lesson";
import { LESSONS } from "../lib/lessons";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const site = "https://club.test";
const mails = {
  welcome: welcomeEmail({ name: "Ada Lovelace", site, unsubscribe: `${site}/u` }),
  broadcast: broadcastEmail({ subject: "Hello", message: "A note to everyone.\n\nSee https://club.test/events", site, unsubscribe: `${site}/u` }),
  certificate: certificateEmail({ name: "Ada Lovelace", eventTitle: "GIT Merge 26", url: `${site}/certificates/1`, site }),
  digest: digestEmail({ from: "2026-11-02", to: "2026-11-09", signups: { count: 2, first: ["@ada"] }, messages: [], feedback: [] } as never, site),
  ...Object.fromEntries(LESSONS.map((l) => [`lesson ${l.slug}`, lessonEmail({ lesson: l, name: "Ada", site, unsubscribe: `${site}/u`, why: "Why." })])),
};

for (const [name, m] of Object.entries(mails)) {
  const problems = [
    !/^<!doctype html><html lang="en"><head><meta charset="utf-8">/.test(m.html) && "no complete <head>",
    !/<title>[^<]+<\/title>/.test(m.html) && "no title",
    /<link |<script|@import|<form|<iframe/i.test(m.html) && "an outside stylesheet, script, form or frame",
    m.text.trim().length < 40 && "no real plain-text copy",
    /\b(FREE|URGENT|ACT NOW|WINNER|CLICK HERE)\b/.test(m.subject + m.html) && "a spam trigger word",
    /!{2,}/.test(m.subject) && "!! in the subject",
    /href="https?:\/\/(bit\.ly|tinyurl|t\.co|goo\.gl)\//.test(m.html) && "a link shortener",
  ].filter(Boolean);
  ok(`${name}: ${problems.length ? problems.join(", ") : "looks like a message from people"}`, problems.length === 0);
}

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall email hygiene checks passed");
