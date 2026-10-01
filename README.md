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
- **Countdown banner** — set `EPOCH.startsAt` in `lib/epoch/config.ts` once dates are announced; during Epoch the banner says it's live.

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

- Club content (events, tracks, team, FAQ, socials): [`lib/config.ts`](lib/config.ts)
- Epoch settings (ticket price, booths, recharge points, merch, schedule): [`lib/epoch/config.ts`](lib/epoch/config.ts)

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

## Stickers

The Octodex stickers in `public/stickers` are generated from `public/GitHub_stickers` (47 MB, not committed) by `node scripts/stickers.mjs`. To use a different sticker, add it to the `PICK` list in that script and to `StickerName` in `components/ui/Sticker.tsx`.

## Tests

- `npm test` — the coin rules (demo store), the ask engine, club sign-ups (validator + `/api/join`), and the **real Supabase SQL** run inside PGlite (Postgres in WASM).
- `npm run test:e2e` — **browser tests** (Playwright): the whole Epoch coin flow, the offline wallet, the join/contact forms, security headers, and that no page scrolls sideways on a phone. Build first (`npm run build`); locally it uses your installed Edge.
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
