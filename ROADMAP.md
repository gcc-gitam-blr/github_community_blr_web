# Roadmap

How we get from "built and live" to "outstanding, and nobody has to touch it". Last updated 4 October 2026.

**Where we are.** The safety net, the real-content pages and most of the community features are live. Event recaps, the contribution board, the content editor and the Epoch load test are built and tested on `feat/club-upgrades`, waiting to be merged. What's left is mostly Epoch organiser tooling, a few small reliability jobs, and decisions only the club can make.

**How changes ship**

```
main               ← the live site (Vercel production)
 └─ feat/…  fix/…  ← one branch per change; Vercel builds a preview URL for each
```

Open the branch's preview, check it, then merge into `main`. Small content fixes (adding a contributor, fixing a typo) go straight to `main`. The old `dev` branch is no longer used.

**Status:** **Done** · **In review** (built and tested on `feat/club-upgrades`, live once merged) · **Partly** · **Needs you** (waiting on a decision, a login or content) · **To do**
**Effort:** **S** ≈ under an hour · **M** ≈ a few hours · **L** ≈ a day or more

---

## Phase 0 — Safety net

| # | Item | Status | Notes |
|---|------|--------|-------|
| 0.1 | Branch previews | Partly | Every branch gets a Vercel preview. **Needs you:** protect `main` in GitHub (require a pull request and passing CI). It isn't protected today. |
| 0.2 | Browser tests in CI | Done | About 70 Playwright tests on every push: every page, the forms, the Epoch coin flow, phones down to 320 px, accessibility. |
| 0.3 | Lighthouse budget in CI | To do · S | Fail a pull request if accessibility drops below 95 or Epoch gets slower. |
| 0.4 | Error monitoring (Sentry, free) | To do · S | **Needs you:** create the Sentry project. Tells us when something breaks on someone's phone. |
| 0.5 | Security headers + CSP | Done | Checked on every page in CI. |

## Phase 1 — Real content

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | Team section | Done | Mentors, leads, members with crew roles, and 20 contributors. Only 2 people have a GitHub handle on the site; handles add avatars and put people on the contribution board. |
| 1.2 | Photo gallery | Partly | Built: fast, location data stripped, full-screen viewer. Hidden until there are photos. **Needs you:** photos from sessions. |
| 1.3 | A message from the club lead | Needs you | 3–4 sentences and a name. |
| 1.4 | Event dates reconciled | Partly | Dates and Luma links are set (Learn GitHub is 7 October). **Needs you:** start and end times, rooms, Epoch's dates. |
| 1.5 | Privacy page | Done | `/privacy`. |
| 1.6 | A real club email | Needs you | The club email is empty in the club settings. |
| 1.7 | Event recaps | In review | After an event: numbers, what happened, photos, a YouTube video and the slides, filled in from the content editor. Nothing shows until someone writes one. |

## Phase 2 — Join & community

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | Welcome email on sign-up | Done | Sent through the club's Gmail (`npm run connect` sets it up), with an unsubscribe link. |
| 2.2 | Organiser emails | Partly | Organisers can email every member from `/admin`. To do: a weekly sign-up digest to organisers · S. |
| 2.3 | Durable rate limiting | To do · S | Form limits reset whenever Vercel starts a new server. Move the counter into the database. |
| 2.4 | Learning hub | Done | `/learn`. |
| 2.5 | Good first issues feed | Done | `/contribute`: live beginner issues from across GitHub. The club-projects part returns once the club has its own org (see Decisions). |
| 2.6 | Member contribution board | In review | `/board`: pull requests members got merged into other people's projects this club year, live from GitHub. It fills up as GitHub handles are added. |
| 2.7 | Certificates | Done | Organisers import Luma's check-in list; each attendee gets a shareable certificate page. |

## Phase 3 — Epoch, ready for the real day

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.1 | Supabase live + GitHub login | Partly | Supabase is connected (sign-ups, messages, feedback). The club's own "Sign in with GitHub" is built. **Needs you:** check its GitHub keys are in Vercel, then a full run-through on the real database. |
| 3.2 | Ticket payment | Needs you | Decide: pay at the desk (current) or online (Razorpay). The price shows "To be announced". |
| 3.3 | Volunteer role + booth scanner mode | Partly | The volunteer role exists (check-in, awards). To do: limit each volunteer to their own booth; booth QR kiosks · M. |
| 3.4 | Organiser tools | Partly | Done: `/admin` with sign-ups and CSV, attendance, certificates, roles, emails, club stats. To do: undo or refund a transaction in one tap, attendee search, an audit log of who did what · M. |
| 3.5 | Live leaderboard & "happening now" | To do · M | Supabase Realtime, so phones update without refreshing. |
| 3.6 | Announcements | Done | The bar above the header. Editable in the content editor once it's merged. |
| 3.7 | Wallet history | Partly | The wallet lists every transaction. To do: a receipt per transaction and filters · S. |
| 3.8 | Load test | In review | `npm run load-test` plays 300 phones at once against a real Postgres. No double charges, no negative balances, shop stock correct, zero errors; slowest call 0.3 s. With 600 phones on half the connections: still correct, slowest call 1 s. Before the day, run a smaller test on the real Supabase project too. |
| 3.9 | Dress rehearsal | Needs you | A small mock event with 5 volunteers and the real flow, a week before. |
| 3.10 | Organiser & attendee guides | To do · S | One printable page each: verifying tickets, scanning, refunds; using the wallet. |
| 3.11 | Oddval font | Needs you | The licensed file. Mona Sans until then. |
| 3.12 | Booth prices confirmed | Needs you | Only VR = 40 and recharge = 20 come from the plan; the rest are placeholders in `lib/epoch/config.ts` and `supabase/schema.sql`. |

## Phase 4 — Polish & reach

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | Dark mode | To do · L | Needs a careful colour pass; follows the visitor's system setting. |
| 4.2 | Home page speed on phones | Partly | A phone speed pass is done (3D stickers are desktop-only). To do: measure with Lighthouse and lock it in with 0.3. |
| 4.3 | Accessibility audit | Partly | Automated WCAG A/AA checks on every page, plus keyboard and reduced-motion tests, in CI. To do: a manual screen-reader pass (NVDA). |
| 4.4 | Site search | Done | Press `/` anywhere. |
| 4.5 | "Notify me" for Epoch dates | To do · S | Collect interest now; email when dates are announced. |
| 4.6 | Kannada / Hindi | To do · L | Optional. Only if many members would prefer it. |
| 4.7 | Social share cards | Done | Home, every event, Epoch. |
| 4.8 | Custom domain | Needs you | Shortlist: `ghblr.club`, `ghblr.in`, `gitblr.dev` (no DNS records on 4 October 2026; confirm at a registrar). Keep "github" out of the name. Then: connect it in Vercel and update the GitHub sign-in and content-editor callback URLs · S. |

## Phase 5 — Keeping it alive

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1 | Content in one place | In review | All content lives in `content/`, with a form-based editor at `/keystatic`. Each save is a commit, so there's history and undo. **Needs you once:** connect the editor to GitHub (README, about 10 minutes). Not yet: photo uploads in the editor; photos still go through the script, which strips location data. |
| 5.2 | Contributor onboarding | Partly | `CONTRIBUTING.md`, issue templates and labels exist. To do: open a few labelled "good first issue"s on this repo; there are none open · S. |
| 5.3 | Year-rollover guide | To do · S | Running the site for 2027-28: what to change, in what order. |
| 5.4 | Backups & data retention | To do · S | Supabase backups; delete sign-up data after N months. |
| 5.5 | Uptime check | To do · S | A free monitor (e.g. UptimeRobot) on the home page and `/epoch`. |

---

## Built beyond the original plan

- **Updates**: a news page at `/updates`, with an RSS feed.
- **What GitHub shipped**: GitHub Changelog headlines on the home page, linking to GitHub's own posts.
- **Get involved**: `/get-involved`, a form for volunteers, speakers, sponsors and core-team applications.
- **Event feedback**: an anonymous rating form on each event's page.
- **Calendar files**: the whole year, or one event, for Google, Apple or Outlook Calendar.
- **`npm run connect`**: one command that switches on Supabase and Gmail and checks both work.
- **Our own GitHub sign-in**, on the club's domain rather than Supabase's.
- **Crew roles**: technical roles and levels for the team, modelled on engineering teams.
- **The look**: the commit-graph header, the phone menu, laptop-lid stickers, 3D stickers on desktop.
- **Epoch sponsors** section, which appears once there are sponsors.
- **Dependabot** keeps packages up to date.

## Ideas for later

Roughly in order of impact for the effort.

| Idea | Effort | Why |
|------|--------|-----|
| An October contribution challenge on the board | S | Hacktoberfest month: merge 4 PRs into other people's projects, get a certificate and a spot on the board. Uses what's already built. |
| QR check-in at the door | M | Attendance and certificates appear instantly, without importing Luma's CSV. |
| "My club" page | M | Sign in with GitHub: your events, certificates and merged PRs in one place. A reason to come back. |
| Club projects showcase | M | Once the club has its own org: live repos, their beginner issues and their contributors. |
| Photo uploads in the editor | M | A GitHub Action that processes uploads (strips location data, resizes), so nobody needs the script. |
| Badges | M | First PR, five PRs, first review: shareable images for profiles and LinkedIn. |
| Session materials archive | S | Slides, recordings and exercises from every session, linked from the Learn hub. |
| Epoch big-screen mode | S–M | A projector view: leaderboard, what's on now, announcements. |
| Monthly newsletter | S | A digest of updates, sent with the email tools already built. |
| Alumni wall | S | Where past members went (internships, jobs), with their consent. |
| Ask a mentor | M | A simple way to book a mentor's time or ask a question between sessions. |

## Decisions to make

1. **The GitHub organisation.** The old org (`github-community-gitam`) is run by another branch of the university, and the site still points to it (club settings → GitHub organisation). Create the club's own org, then change that one setting.
2. **GitHub's brand and the Octodex artwork.** Fine for a student club: keep them decorative, keep the "not affiliated" line, and keep "github" out of the domain.
3. **Who can edit content.** The editor gives anyone with write access to this repository the power to change the live site. Give that access only to people you trust; they can save to a branch for review instead.
4. **Online payments change the risk.** Money means refunds, receipts and GST questions. Paying at the desk keeps Epoch simpler; online can come later.
5. **Photos of people.** Get consent; show first names only if members prefer.
6. **Demo mode is only a demo.** Epoch's organiser code is visible in the browser in demo mode. In live mode, roles come from the database.

## Next steps, in order

1. Check the `feat/club-upgrades` preview, then merge it into `main`.
2. Connect the content editor to GitHub (README).
3. Protect `main` in GitHub.
4. Collect members' GitHub handles; add them in the editor.
5. Pick and buy the domain.
6. After 7 October: photos, then the first recap.
7. Epoch decisions: ticket price, payment method, booth prices, dates.
