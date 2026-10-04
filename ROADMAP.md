# Roadmap

The live checklist for the club site. Every item has a status and the exact page to open to check it. This file is updated as work lands, so it is the place to look. Last updated: 4 October 2026.

## How to check

- **Everything is live:** https://githubcommunityblr.vercel.app. New work lands there directly, a minute or two after each push.
- **The content editor:** https://githubcommunityblr.vercel.app/keystatic (log in with GitHub). Each save goes live in 1–2 minutes.
- Where real content doesn't exist yet (board, memories), the live site shows nothing rather than placeholders.

**Status:** ✅ Done (live, tested) · 🟡 In progress · ⬜ Not started · 🙋 Needs you (a decision, a login or content)

**Working order, one at a time:** phases 0–5 are built. **Now: Phase 6, below**, one feature after another, straight to the live site.

---

## Settings you need to add (once)

All done except `CRON_SECRET`.

| | Where | What | Turns on |
|---|---|---|---|
| ✅ | Supabase → SQL editor (or `npm run connect`) | Re-run `supabase/schema.sql` | Error reports, shared form limits, the Epoch dates list, the weekly clean-up, booths for volunteers, reversals and the audit log |
| 🙋 | Vercel → Settings → Environment Variables | `CRON_SECRET` (any long random text) | The weekly clean-up and the Monday digest |
| ✅ | Vercel → Settings → Environment Variables | `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API) | The clean-up, the digest and GitHub sign-in |
| ✅ | GitHub → Settings → Secrets → Actions | `SUPABASE_DB_URL` (Supabase → Connect → connection string) | Weekly backups |
| ✅ | GitHub → Settings → Variables → Actions | `SITE_URL` (the live site's address) | The uptime check |
| ✅ | README → "The content editor on the live site" | Create the GitHub App, add its 4 keys to Vercel | Editing content on the live site |

---

## Phase 0 — Safety net

| | # | Item | Check it | Notes |
|---|---|------|----------|-------|
| ✅ | 0.1 | Branch previews | https://githubcommunityblr.vercel.app | Every branch gets a preview. 🙋 Protect `main` in GitHub when you're ready (you said later; the repo is private). |
| ✅ | 0.2 | Browser tests in CI | https://github.com/lechakrawarthy/github_community_blr/actions | 75 Playwright tests on every push: pages, forms, Epoch coin flow, phones down to 320 px, accessibility. |
| ✅ | 0.3 | Lighthouse budget in CI | https://github.com/lechakrawarthy/github_community_blr/actions → newest **CI** run → *lighthouse-reports* | Accessibility under 0.95 on any of 5 key pages fails the build; slower pages only warn. |
| ✅ | 0.4 | Error monitoring | https://githubcommunityblr.vercel.app/admin → **Site errors** (organiser login) | Browser errors are reported to the site itself, grouped with counts. No outside service. 🙋 Needs `supabase/schema.sql` re-run. |
| ✅ | 0.5 | Security headers + CSP | Nothing to click | Checked on every page by the tests. |

## Phase 1 — Real content

| | # | Item | Check it | Notes |
|---|---|------|----------|-------|
| ✅ | 1.1 | Team section | https://githubcommunityblr.vercel.app/#team | 🙋 Only 2 people have a GitHub handle; handles add avatars and the board. |
| ✅ | 1.2 | Photo gallery | https://githubcommunityblr.vercel.app/ (appears above the FAQ once there are photos) | 🙋 Photos: `photos-inbox/<folder>/`, then `node scripts/photos.mjs`. |
| 🙋 | 1.3 | A message from the club lead | — | 3–4 sentences and a name. |
| 🙋 | 1.4 | Event times and rooms | https://githubcommunityblr.vercel.app/#events | Dates and Luma links are set. Times, rooms and Epoch's dates are needed. |
| ✅ | 1.5 | Privacy page | https://githubcommunityblr.vercel.app/privacy | |
| ✅ | 1.6 | Club email | https://githubcommunityblr.vercel.app/ (footer) | github_community@gitam.in |
| ✅ | 1.7 | Event recaps | https://githubcommunityblr.vercel.app/keystatic → Events → an event → Recap | Write one, then open that event's page. Nothing shows until a recap is written. |
| ✅ | 1.8 | **Memories** (new) | https://githubcommunityblr.vercel.app/memories | The club's story year by year, real leaders, thank-you wall. Sample photos on the preview. Hidden from menus on the live site until real photos are added. 🙋 Photos and each year's story: https://githubcommunityblr.vercel.app/keystatic → Memories |

## Phase 2 — Join & community

| | # | Item | Check it | Notes |
|---|---|------|----------|-------|
| ✅ | 2.1 | Welcome email on sign-up | Join on https://githubcommunityblr.vercel.app/#join with your own email | |
| ✅ | 2.2 | Weekly digest to organisers | Your inbox, Monday 9:00 | 🙋 Turns on when `CRON_SECRET` is set in Vercel. Optional `ORGANISER_EMAILS`. |
| ✅ | 2.3 | Durable rate limiting | Nothing to click | Form limits are counted in the database, so they hold across every server. Only a scrambled code is stored, never an IP. |
| ✅ | 2.4 | Learning hub | https://githubcommunityblr.vercel.app/learn | |
| ✅ | 2.5 | Good first issues feed | https://githubcommunityblr.vercel.app/contribute | The club-projects part comes back once the club has its own org. |
| ✅ | 2.6 | Contribution board | https://githubcommunityblr.vercel.app/board | Sample on the preview. 🙋 Members' GitHub handles fill it. |
| ✅ | 2.7 | Certificates | https://githubcommunityblr.vercel.app/admin → Attendance | Needs an organiser login and a Luma check-in list. |
| ✅ | 2.8 | **October contribution challenge** (new) | https://githubcommunityblr.vercel.app/board (top) | Sample on the preview. 🙋 Set the real one: https://githubcommunityblr.vercel.app/keystatic → Contribution challenge |

## Phase 3 — Epoch, ready for the real day

| | # | Item | Check it | Notes |
|---|---|------|----------|-------|
| 🙋 | 3.1 | Supabase live + GitHub login | https://githubcommunityblr.vercel.app/epoch/register | Supabase is connected. Check the GitHub sign-in keys are in Vercel, then a full run-through. |
| ✅ | 3.2 | Ticket payment | — | Decided: paid at the desk. No online payments. |
| ✅ | 3.3 | Volunteers limited to their booth + booth kiosk | https://githubcommunityblr.vercel.app/epoch/kiosk/vr (a booth's kiosk screen) and https://githubcommunityblr.vercel.app/epoch/admin → **Team** (put a volunteer on a booth) | A volunteer only scans and reverses at their own booth; without a booth they only check people in at the desk. Every booth on https://githubcommunityblr.vercel.app/epoch/admin has an "Open as a kiosk" link. |
| ✅ | 3.4 | Organiser tools: reverse a charge, search, audit log | https://githubcommunityblr.vercel.app/epoch/admin → **Find someone** and **Audit log** | Reversals add the opposite amount; nothing is deleted, nothing is reversed twice, no balance goes below zero. Load-tested with 150 reversals at once. |
| ✅ | 3.5 | Live leaderboard + "happening now" + big screen | https://githubcommunityblr.vercel.app/epoch/leaderboard (updates without a refresh) and https://githubcommunityblr.vercel.app/epoch/screen (open it full screen on a TV) | "Happening now" appears on https://githubcommunityblr.vercel.app/epoch once Epoch's start time is set. 🙋 Re-run `supabase/schema.sql` (it switches on Realtime for the leaderboard). |
| ✅ | 3.6 | Announcements | https://githubcommunityblr.vercel.app/keystatic → Announcements | Add one; it shows above the header. |
| ✅ | 3.7 | Wallet receipts and filters | https://githubcommunityblr.vercel.app/epoch/wallet → tap any line | Register first at https://githubcommunityblr.vercel.app/epoch/register. Receipts work offline too. |
| ✅ | 3.8 | Load test | Run `npm run load-test` (needs Docker Desktop) | 300 phones at once: no double charges, no negative balances, zero errors. |
| 🙋 | 3.9 | Dress rehearsal | — | A week before Epoch. |
| ✅ | 3.10 | Printable guides (attendees, organisers) | https://githubcommunityblr.vercel.app/epoch/guide and https://githubcommunityblr.vercel.app/epoch/guide/organisers (try Print) | One A4 page each. 🙋 Add the day's phone contacts: https://githubcommunityblr.vercel.app/keystatic → Epoch settings → Contacts |
| 🙋 | 3.11 | Oddval font | — | The licensed file. Mona Sans until then. |
| 🙋 | 3.12 | Booth prices | — | Only VR = 40 and recharge = 20 come from the plan; the rest are placeholders. |
| ✅ | 3.13 | **"Tell me when the dates are out"** (new) | https://githubcommunityblr.vercel.app/epoch and the home page's Epoch band | Organisers email the list from /admin. 🙋 Re-run `supabase/schema.sql` (`npm run connect`). |

## Phase 4 — Polish & reach

| | # | Item | Check it | Notes |
|---|---|------|----------|-------|
| ✅ | 4.1 | Dark mode | https://githubcommunityblr.vercel.app/ with your phone or laptop set to dark mode (or Chrome DevTools → Rendering → prefers-color-scheme: dark) | True black. Follows the system until you choose: the ☀/☾ switch in the header, or System · Light · Dark in the footer and the phone menu. Every club page is checked for contrast in dark mode too. Epoch and the content editor keep their own light look. |
| ✅ | 4.2 | Home page speed on phones | https://github.com/lechakrawarthy/github_community_blr/actions → newest **CI** run → *lighthouse-reports* | Speed is measured on every push and warns if a page gets slower. |
| 🙋 | 4.3 | Accessibility audit | — | Automated checks on every page are done. A manual screen-reader pass (NVDA) needs a person. |
| ✅ | 4.4 | Site search | https://githubcommunityblr.vercel.app/ then press `/` | |
| ✅ | 4.5 | "Notify me" for Epoch dates | Same as 3.13 | |
| ✅ | 4.7 | Social share cards | Share any page in WhatsApp | |
| 🙋 | 4.8 | Custom domain | — | Later, when you've picked one. Shortlist: `ghblr.com`, `ghblr.in`, `ghblr.club`, `gitblr.dev`. |

## Phase 5 — Keeping it alive

| | # | Item | Check it | Notes |
|---|---|------|----------|-------|
| ✅ | 5.1 | Content editor | https://githubcommunityblr.vercel.app/keystatic | Every save is a commit. 🙋 Connect it to GitHub for the live site (README, ~10 min). |
| ✅ | 5.2 | Contributor onboarding | https://github.com/lechakrawarthy/github_community_blr/issues?q=is%3Aopen+label%3A%22good+first+issue%22 | 5 starter issues (#7–#11), each naming the exact file; CONTRIBUTING.md points to them and says pull requests go to `dev`. 🙋 The repo is private: add members as collaborators so they can pick them up. |
| ✅ | 5.3 | Year-rollover guide | https://github.com/lechakrawarthy/github_community_blr/blob/main/docs/ROLLOVER.md | Plain steps for next year's team. |
| ✅ | 5.4 | Backups & data retention | https://githubcommunityblr.vercel.app/privacy (how long each thing is kept) | Weekly clean-up of old data, weekly backup kept 30 days. 🙋 `CRON_SECRET` in Vercel, `SUPABASE_DB_URL` secret in GitHub. |
| ✅ | 5.5 | Uptime check | https://github.com/lechakrawarthy/github_community_blr/actions/workflows/uptime.yml | Every 6 hours; opens a "Site is down" issue if the site fails. 🙋 The `SITE_URL` repository variable. |

## Phase 6 — New features (building now, in this order)

| | Feature | Check it | What it is |
|---|---------|----------|------------|
| ✅ | Session materials archive | https://githubcommunityblr.vercel.app/learn (top: "From our sessions") | Fills itself from each event's recap. 🙋 After a session: https://githubcommunityblr.vercel.app/keystatic → Events → the event → Recap → Slides, Video, More links. |
| ✅ | Alumni wall | https://githubcommunityblr.vercel.app/memories#alumni | "Where they are now", alumni as forks of the club. 🙋 Add people at https://githubcommunityblr.vercel.app/keystatic → Alumni and tick "They said yes"; until then it invites past members to get in touch. |
| ✅ | Badges | https://githubcommunityblr.vercel.app/board and each member's page, e.g. https://githubcommunityblr.vercel.app/board/lechakrawarthy | First merge, Five merged, Ten merged, Three projects, Challenge finisher: earned from real merges only. Every member page has a share card. |
| ✅ | "My club" page | https://githubcommunityblr.vercel.app/me (also in the footer) | Sign in with GitHub: the events you came to with their certificates, your board page (merges and badges), your Epoch wallet. 🙋 Re-run `supabase/schema.sql` once more (it adds `my_attendance`). |
| ⬜ | Monthly newsletter | https://githubcommunityblr.vercel.app/admin | A draft built from the month's updates, events and recaps; an organiser reads it, then sends it to members. |
| ⬜ | Photo uploads in the editor | https://githubcommunityblr.vercel.app/keystatic | Add photos in the editor; GitHub resizes them and strips location data, so nobody needs the script. |
| 🙋 | Club projects showcase | — | After the club creates its own GitHub organisation: live repos, their beginner issues and contributors. |

Decided against: QR check-in at the door (Luma already does it), Kannada/Hindi.

## More ideas

| Idea | Why |
|------|-----|
| Profile README builder | A form that writes a GitHub profile README for you; a perfect hand-out for the Profile Makeover workshop. |
| Open-source sprint weekends | A page per sprint: the repos to target and a live count of what members merged that weekend. |
| Ask a mentor | Book a short slot with a mentor, or ask a question between sessions. |
| The club in numbers | A public page: members, events, merged pull requests, all counted from real data. |
| Merged this week | A shout-out on the home page for the latest member pull request merged anywhere. |
| Study buddies | Pair beginners with someone a step ahead, for their first pull request. |

## Decisions to make

1. **GitHub organisation.** The site still points to the old org run by another branch of the university (club settings → GitHub organisation). Talk later.
2. **Who can edit content.** Anyone with write access to this repository can change the live site through the editor.
3. **Photos of people.** Get consent; first names only if members prefer.
4. **Demo mode** shows Epoch's organiser code in the browser. In live mode, roles come from the database.
