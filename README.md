# GitHub Community Club BLR

Website for the GitHub Community Club at GITAM University Bengaluru — **Code. Collaborate. Contribute.** — plus **Epoch**, our annual fest: registration, Epoch Coins, QR scanning, a shop and a live leaderboard.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js (App Router) + React + TypeScript** | Routing, server-rendered club site, and real app screens for Epoch |
| Styling | **Tailwind CSS v4** | Design tokens in `app/globals.css`; the signature animations are plain CSS keyframes + Motion |
| Motion | **Motion** (`motion/react`) | Scroll reveals, the club → Epoch page transition, coin/QR result animations |
| Backend | **Supabase** (Postgres + GitHub OAuth) | Shared coin balances across every phone. Optional — see below |
| QR | `qrcode.react` (generate) + `html5-qrcode` (camera scan) | Wallet passes and stall codes |

## Features at a glance

- **Club site** — git-graph hero, contribution-graph calendar of the year, a page per event (laid out like a GitHub release, with its own calendar file, share image and schema.org data), FAQ as closed issues, joining as a pull request.
- **Club sign-ups** — the Join form posts to `/api/join` (validated, rate-limited, honeypot) and stores rows in Supabase's `join_requests`; organisers see them on `/epoch/admin` with a CSV export. Without Supabase it falls back to `joinUrl` / `email`.
- **Epoch** — coin economy with ticket verification, recharge points, booths, merch, leaderboard, QR scanning and a command bar (press `/`).
- **Installable & offline** — Epoch has a web app manifest and a service worker: attendees can add the wallet to their home screen, and the wallet, QR pass and booths still open without signal.
- **Calendar** — `/calendar.ics` (whole year) and `/events/<slug>/event.ics` (one event).
- **Countdown banner** — set Epoch's start time in the content editor (Epoch settings) once dates are announced; during Epoch the banner says it's live.
- **Content editor** — `/keystatic`: forms for events, recaps, team, contributors, FAQ, updates and Epoch's dates and schedule. Every save is a commit, so there's history and undo.

## Switch on messages, sign-ups and email (5 minutes)

Until this is done the site still works: **Join** sends people to the WhatsApp community and **Get involved** hands the message to the club Instagram DM.
To store sign-ups and messages and send email for real, run once:

```bash
npm run connect
```

It asks for three things and checks each one before moving on:

1. **Supabase** (free): project URL + anon key (Project Settings → API), then the *Session pooler* connection string (Connect button). It creates every table. Safe to run again after updates.
2. **Gmail**: the club address + an [App Password](https://myaccount.google.com/apppasswords). It sends you a test email.
3. **Vercel** (optional): a [token](https://vercel.com/account/tokens), and it saves the same settings on the live site. Redeploy once afterwards.

Everything is saved in `.env.local` (never committed). To make someone an organiser after they sign in to Epoch once: `npm run connect -- admin <github-handle>`.

## Club admin, attendance and certificates

`/admin` is the core team's dashboard: club stats, sign-ups (and emailing everyone), Get involved messages, event feedback, **attendance & certificates**, and **people & roles**.

- **Who gets in** is decided by the database (`profiles.role`): *admin* (everything), *volunteer* (sees everything, marks attendance), everyone else sees "ask an admin".
- **The first admin** is set once in Supabase → SQL Editor: `update profiles set role = 'admin' where handle = 'your-github-username';` (sign in at `/admin` once first). After that, admins add people under **People & roles**.
- **Certificates go only to people who attended.** After an event, open **Attendance & certificates**, pick the event and add who came: import Luma's guest list (Event → Guests → ⋯ → Export as CSV — only checked-in guests are taken), pick from club sign-ups, or type them in. Then **Email certificates**. Each person gets a link to their certificate page — printable as an A4 PDF, with an *Add to LinkedIn* button and a QR code anyone can scan to verify it.

### Sign in with GitHub on the site's own address

Browsers' phishing filters sometimes flag new `*.supabase.co` sign-in pages. To keep people on your own domain the whole way:

1. Create a **second** GitHub OAuth App (github.com/settings/developers) with the **Authorization callback URL** `https://<your-site>/api/auth/github/callback`. Keep the first one in Supabase — it's still used for previews and `localhost`.
2. In Vercel, add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (from the new OAuth App) and `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys — server only, never `NEXT_PUBLIC_`). Redeploy.

It works on the production address. Preview deployments and `localhost` automatically use Supabase's own GitHub sign-in instead.

## Settings (environment variables)

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Live Epoch + stored club sign-ups. Empty = demo mode. |
| `NEXT_PUBLIC_SITE_URL` | Optional custom domain. On Vercel the production domain is used automatically. |
| `NEXT_PUBLIC_EPOCH_MODE` | `live` / `off` forces Epoch's live state. |
| `NEXT_PUBLIC_ANALYTICS` | `on` loads cookie-free Vercel Analytics + Speed Insights (enable them in the Vercel dashboard first). |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Epoch works out of the box in **demo mode** (data lives in your browser's localStorage — register a few accounts and scan between them to try the flow).

## Make it yours

- Club content (events, recaps, team, contributors, FAQ, socials, updates): the content editor at `/keystatic`, which saves to [`content/`](content/). Run `npm run dev` and open http://localhost:3000/keystatic, or edit the JSON by hand.
- Epoch dates, venue, ticket, sponsors and schedule: the editor too ([`content/epoch/`](content/epoch/)).
- Epoch coins, booths, recharge points and merch: [`lib/epoch/config.ts`](lib/epoch/config.ts) — they're code because `supabase/schema.sql` seeds the same values, and both must match.

### The content editor on the live site (once, about 10 minutes)

Locally the editor writes straight to your files. On the live site it signs editors in with GitHub and saves each change as a commit (or a pull request, if they choose a branch). Anyone with write access to this repository can edit.

1. Run `npm run dev` with `NEXT_PUBLIC_KEYSTATIC_GITHUB=1` in `.env.local`, open http://localhost:3000/keystatic and follow **Create GitHub App**. Keystatic creates the app and writes four `KEYSTATIC_*` values into `.env`.
2. Copy those four values into Vercel → Settings → Environment Variables (Production), then redeploy.
3. In the GitHub App's settings, add the live site's callback URL: `https://<your-domain>/api/keystatic/github/oauth/callback`.

Until then `/keystatic` on the live site says it isn't connected — the rest of the site is unaffected.

Things that are **empty until you fill them in** (the site hides them rather than showing fake content):

- `joinUrl` or `email` — where "Join the club" sends people (a Google Form / WhatsApp link, or a real address). Until set, the form says sign-ups aren't connected yet.
- `githubOrg` — shows the Projects section with live repos, plus the GitHub links in the nav and footer.
- `team` — add real people and the "core team" section appears.
- `socials` — add real links and the footer shows them.

## Epoch: going live for the fest

1. Create a free project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor. All coin movement happens in database functions, so a tampered browser can't mint coins, and recharge points work once per attendee.
3. Enable **Authentication → Providers → GitHub**, with redirect URL `https://<your-domain>/epoch/register`.
4. Copy `.env.example` to `.env.local` and fill in the URL and anon key.
5. After you sign in once, make yourself admin: `update profiles set role = 'admin' where handle = 'your-handle';`
6. Open `/epoch/admin`, **print the QR sheet**, and put one code on each booth.

**Epoch mode:** the *EPOCH* item in the nav and the black-disc page transition are always there; the live dot and countdown follow `opensAt`/`closesAt`. Force it with `NEXT_PUBLIC_EPOCH_MODE=live|off`.

### How coins flow (from the original Epoch plan)

- **Check-in → coins.** Everyone gets **398 EPC** (`EPOCH.starterCoins`). The attendee registers, then shows their wallet QR at the registration desk; an organiser scans it and presses *Verify ticket*. Coins are credited once — a second attempt is refused. The ticket price is undecided (it may be free): set `EPOCH.ticketPriceINR` when it's fixed and the site will show it.
- **Spend booths** (`epoch:b:<id>`) charge coins per session (VR = 40) and can be repeated, with a 20-second double-scan guard.
- **Recharge points** pay **once per attendee, per point** (20 coins in the plan). The wallet shows how many are left.
- **Merch stall** sells tees, hoodies and stickers for coins; stock is decremented atomically.
- **Organiser desk** (`/epoch/admin`) prints the booth QR sheet; scanning a wallet also allows manual awards/deductions (competition prizes, refunds) with a reason in the ledger.
- Attendees see balance, full ledger and remaining recharge points, refreshed every few seconds.

> Only VR = 40 and the recharge reward = 20 come from the plan. Every other price, the ticket price and the recharge-point names are **placeholders** in `lib/epoch/config.ts` — confirm them.

`npm test` runs the economy rules against the demo store.

## Epoch: what's in the design

- **Glass command bar** (press `/` or ⌘/Ctrl-K): jump to any page, booth or session, or ask a question — “how much is VR?”, “when do recharge points work?”. Answers come from the real config in `lib/epoch/ask.ts` (no external AI) and are covered by `npm test`.
- **The coin**: drawn as SVG (`components/epoch/EpochCoin.tsx`, also `public/epoch-coin.svg`) and rendered as a physical 3D coin with Three.js (`Coin3DScene.tsx`); it falls back to the flat SVG without WebGL or with reduced motion.
- **Dashboard wallet**: “Howdy” greeting, glass activity feed, Quick access column, left rail.
- **Landing**: gradient headline, dark economy panel, colour-block booth categories that filter the list, dotted rules and a giant dotted call-to-action.

## Photos (gallery)

The home page shows a gallery once there are photos. To add them:
1. Download the photos from Drive and put them on your computer in `photos-inbox/<event-name>/` — one folder per event (e.g. `photos-inbox/git-101-sept-2024/IMG_001.jpg`). Optional captions: `captions.json` in the folder, `{"IMG_001.jpg": "Mentors helping with a first pull request"}`.
2. Run `node scripts/photos.mjs`. It fixes rotation, **removes hidden location/camera data**, makes three small WebP sizes, and fills `lib/gallery.json`.
3. Commit `public/gallery` and `lib/gallery.json` (the raw `photos-inbox` is git-ignored). Only share photos of people who agreed.

Re-running the script only replaces the folders that are in `photos-inbox` this time; every other folder's photos stay.

## Memories (the club's story)

`/memories` tells the club's story one year at a time: each year's title and story, who led it, its moments (groups of photos) and, if you like, a few real quotes. Who led each year is never typed in here: it comes from the team's **Before** lines (`Former President, 2024-25`) and, for this year, from the current team. The closing thank-you lists everyone on the team and the contributors list.

To add a year's photos (no coding needed apart from step 2):
1. Put the photos of one moment in their own folder: `photos-inbox/<moment>/`, e.g. `photos-inbox/first-session-2024/`. Optional captions as above (`captions.json`).
2. A maintainer runs `node scripts/photos.mjs` and commits `public/gallery` and `lib/gallery.json`. These photos also appear in the home Gallery.
3. In the content editor (`/keystatic` → **Memories**), open the year, add a moment (title, date, caption) and pick its folder from **Photo folder**. Optionally pick the big opening photo under **Opening photo**. Save.

If a folder Memories uses ever drops out of the gallery (say after `node scripts/photos.mjs --fresh` without all the photos in `photos-inbox`), the editor still opens and lists it as **no photos found**, and the photo script prints which folders are missing. Put those photos back in `photos-inbox` and run the script again, or pick another folder.

Until there is at least one photo the page is quiet: it isn't in the header, footer, search or sitemap, and search engines are asked not to index it. The links appear by themselves once photos exist. Vercel **preview** deployments show a clearly labelled sample (Octodex stickers on coloured tiles, never people) so the design can be judged; locally, run with `MEMORIES_SAMPLE=1` to see it. The live site never shows the sample.

## Stickers

The Octodex stickers in `public/stickers` are generated from `public/GitHub_stickers` (47 MB, not committed) by `node scripts/stickers.mjs`. To use a different sticker, add it to the `PICK` list in that script and to `StickerName` in `components/ui/Sticker.tsx`.

## Tests

- `npm test` — the coin rules (demo store), the ask engine, club sign-ups (validator + `/api/join`), and the **real Supabase SQL** run inside PGlite (Postgres in WASM).
- `npm run test:e2e` — **browser tests** (Playwright): the whole Epoch coin flow, the offline wallet, the join/contact forms, security headers, and that no page scrolls sideways on a phone. Build first with `npm run build:test` — it ignores `.env.local`, so tests never write to the real database or send real email (the tests refuse to run against a live build). Locally it uses your installed Edge.
- CI (`.github/workflows/ci.yml`) runs type-check, lint, unit tests, the build and the browser tests on every push and pull request.
- `tests/e2e.epoch.mjs` — the whole coin flow clicked through the real pages (instructions at the top of the file).

## Email: welcome message and organiser broadcasts

When someone joins through the form, the site emails them a welcome (WhatsApp link, next event, what to do first).
Admins can also email **every sign-up** from `/epoch/admin` → *Email everyone*. Every message carries a personal,
signed unsubscribe link (and the one-click header Gmail shows as an "Unsubscribe" button).

Epoch has **no passwords** — attendees sign in with GitHub — so there is no "forgot password" email to build.

**Set it up with a Gmail account (free, about 5 minutes):**
1. Use a club Gmail account (e.g. a shared one the core team controls) and turn on **2-Step Verification**.
2. Go to <https://myaccount.google.com/apppasswords>, create an app password named "club website", copy the 16 letters.
3. In Vercel → Settings → Environment Variables, add (Production, Preview, Development):
   - `EMAIL_FROM` = `GitHub Community Club <your-club@gmail.com>`
   - `SMTP_HOST` = `smtp.gmail.com`, `SMTP_PORT` = `465`
   - `SMTP_USER` = `your-club@gmail.com`, `SMTP_PASS` = the 16-letter app password
   - `EMAIL_SECRET` = any long random text
4. In Supabase, re-run `supabase/schema.sql` (it only adds what's missing) and make yourself admin.
5. Redeploy. Join the form once with your own email — the welcome should arrive within seconds.

Gmail allows about 500 emails a day; the broadcast stops at 450 per send. For bigger lists, use Resend with a verified domain (`RESEND_API_KEY`).
Without any of these settings the site works normally and just doesn't send email.

## Epoch typeface

Epoch is set in **Oddval Medium** ([Type Forward](https://typeforward.com/typefaces/oddval), licensed). Drop `Oddval-Medium.woff2` (or `.otf`/`.ttf`) into `public/fonts/` and the Epoch pages use it automatically; until then they use Mona Sans.

## Deploy

Push to GitHub and import the repo on [Vercel](https://vercel.com) (add the env vars there).

## Not affiliated

A student community project, not officially affiliated with GitHub, Inc.
