# Roadmap

How we get from "built and live" to "outstanding, and nobody has to touch it".

**Branch workflow**

```
main        ← live site (Vercel production). Only receives merges from dev, after you've verified them.
 └─ dev     ← integration branch. Every phase below is merged here first. Vercel gives dev its own preview URL.
     ├─ feat/…  fix/…  chore/…   ← one branch per item, merged into dev
```

Effort: **S** ≈ under an hour · **M** ≈ a few hours · **L** ≈ a day or more.
**You** = needs something from you (a decision, a login, content). Everything else I can do alone.

---

## Phase 0 — Safety net (do first)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 0.1 | `dev` branch + Vercel preview for it | S | You: in GitHub, protect `main` (require a pull request + passing CI). |
| 0.2 | Playwright end-to-end tests in CI | M | Today our browser tests run by hand. Turn them into CI tests for: home, join form, event pages, full coin flow, offline wallet. |
| 0.3 | Lighthouse budget in CI | S | Fail a PR if accessibility drops below 95 or Epoch speed drops. |
| 0.4 | Error monitoring (Sentry free tier) | S | You: create the Sentry project. Tells us when something breaks on someone's phone. |
| 0.5 | Security headers + CSP | M | Content-Security-Policy, frame protection, referrer policy. Test against Supabase, GitHub API, Luma links. |

## Phase 1 — Real content (the site is half-empty without it)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1.1 | **Team section** | S | **You:** names, roles, GitHub handles (avatars load automatically). |
| 1.2 | **Photo gallery** from past sessions | M | **You:** 10–20 photos. I build a fast, accessible gallery with lightbox and optimised images. |
| 1.3 | **A short message from the club lead** | S | **You:** 3–4 sentences + name. Builds trust. |
| 1.4 | Event times, venue rooms, Luma dates reconciled | S | **You:** real start/end times; decide Learn GitHub = 5 Oct or 7 Oct; Epoch dates. |
| 1.5 | Privacy page + terms | S | We collect emails and GitHub handles. A plain-language page saying what, why, who sees it, how to be removed. I draft it; you approve. |
| 1.6 | Contact: a real club email | S | **You:** the address. Shown in the footer and on the privacy page. |
| 1.7 | Past events / "what happened" pages | M | After each event: photos, summary, slides, attendee count. A page per event already exists — add a "recap" state. |

## Phase 2 — Join & community

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 2.1 | Welcome email on sign-up (Resend, free tier) | M | **You:** a sender domain or use Resend's default. Email: welcome, WhatsApp link, next event. |
| 2.2 | Sign-up export + weekly digest to organisers | S | Already have CSV; add a weekly email summary. |
| 2.3 | Durable rate limiting | S | Today the limit is per server instance; move to a database counter so it can't be bypassed. |
| 2.4 | **Learning hub**: `/learn` | M | A roadmap of free resources for every skill on the site (GitHub Skills, Docs, Student Pack, Git tutorials), each linked to the club session that covers it. |
| 2.5 | **Good first issues feed** | M | Live list of beginner-friendly issues from our GitHub org's repos (and a curated list of outside projects) — turns "open source" from a word into an action. |
| 2.6 | Member contribution board | L | Optional: members connect GitHub; we show merged PRs to club repos. Real, unfakeable proof of contribution. |
| 2.7 | Certificates | M | Attendance certificates as shareable pages / PDFs, generated from event attendance. Needs a way to mark attendance (see 3.4). |

## Phase 3 — Epoch, ready for the real day

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 3.1 | **Supabase live + GitHub login** | M | **You:** the co-work Claude prompt we already wrote. After that I verify the whole flow against the real database. |
| 3.2 | Ticket payment | L | **You decide:** pay at the desk (current), or online (Razorpay). Online needs a Razorpay account and a webhook that verifies payments before coins are issued. |
| 3.3 | **Volunteer role + booth scanner mode** | M | A volunteer can only scan/charge for *their* booth, not award arbitrary coins. Booth-specific QR kiosks. |
| 3.4 | Organiser tools | M | Undo / reverse a transaction, refund, search an attendee by handle or email, mark attendance, audit log (who did what, when). |
| 3.5 | Live leaderboard & "happening now" | M | Supabase Realtime: leaderboard and schedule update on every phone without refreshing. |
| 3.6 | Announcements | S | Organisers post a message; it appears as a banner on every attendee's phone. |
| 3.7 | Transaction receipts & wallet history polish | S | Per-transaction detail, running balance, filter. |
| 3.8 | Load test | M | Simulate ~300 phones hitting the wallet and scan at once. Tune queries/indexes. |
| 3.9 | **Dress rehearsal** | M | A fake mini-event with 5 volunteers and the real flow, a week before. Checklist + printed organiser guide. |
| 3.10 | Organiser guide & attendee guide | S | One printable page each: how to verify tickets, scan booths, handle refunds; how attendees use the wallet. |
| 3.11 | Oddval font | S | **You:** the licensed file; I drop it in. |

## Phase 4 — Polish & reach

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 4.1 | **Dark mode** | L | Needs a proper token pass: the site uses the same ink colour for text and dark surfaces. Done carefully, follows the visitor's system setting. |
| 4.2 | Home page speed on phones (63 → 85+) | M | Defer below-fold animation work, trim motion bundle, lazy-load the calendar and primer diagrams. |
| 4.3 | Full accessibility audit | M | Keyboard-only walkthrough, screen-reader pass (NVDA), focus order, reduced motion everywhere. |
| 4.4 | Site search | S | The Epoch command bar (`/`) extended to the club site: events, FAQ, learning hub. |
| 4.5 | Newsletter / "notify me" for Epoch dates | S | Collect interest now; email when dates are announced. |
| 4.6 | Multilingual toggle (Kannada / Hindi) | L | Optional. Worth it if many members prefer it; only the core pages. |
| 4.7 | Social share cards per page | S | Epoch booths, learning hub, gallery. |
| 4.8 | Custom domain | S | **You:** buy/choose it (e.g. githubgitam.club); I wire it on Vercel and update share links. |

## Phase 5 — Keeping it alive

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 5.1 | **Content in one place** | M | Move events, FAQ, team into simple files (or a free CMS like Decap) so a non-coder member can update the site by editing a form, and open a pull request. |
| 5.2 | Contributor onboarding | S | "Good first issues" on *this* repo, labelled and explained. The site becomes the club's own open-source project. |
| 5.3 | Year-rollover guide | S | How to run the site for 2027-28: what to change, in what order. |
| 5.4 | Backups & data retention | S | Supabase backups; delete sign-up data after N months. |
| 5.5 | Uptime check | S | Free monitor (e.g. UptimeRobot) pinging the home page and `/epoch`. |

---

## Risks and decisions to make early

1. **GitHub brand & Octodex artwork.** Fine for a student club; keep decorative, keep the "not affiliated" line. If the club is part of an official GitHub programme, tell me its exact name.
2. **Oddval is a paid font.** Without the licensed file, Epoch uses Mona Sans (already good).
3. **Online payments change the risk profile.** Money means refunds, receipts, GST questions. Pay-at-the-desk keeps Epoch simple and lower-risk; we can add online later.
4. **Photos of people.** Get consent; show first names only if members prefer.
5. **Demo mode is only a demo.** Epoch's organiser code is visible in the browser in demo mode. In live mode, roles come from the database, so this goes away after 3.1.

## Merge order

1. Phase 0 → `dev` → you verify → `main`
2. Phase 1 → `dev` → verify → `main`
3. Phases 2 and 3 in parallel branches, merged to `dev` together → verify → `main`
4. Phase 4, then 5.

Nothing reaches `main` until you've looked at it on the `dev` preview URL.
