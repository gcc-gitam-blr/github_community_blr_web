# GitHub Community Club BLR

Website for the GitHub Community Club, Bengaluru — **Learn. Build. Merge.** — plus **Epoch**, our annual fest: registration, Epoch Coins, QR scanning, a shop and a live leaderboard.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js (App Router) + React + TypeScript** | Routing, server-rendered club site, and real app screens for Epoch |
| Styling | **Tailwind CSS v4** | Design tokens in `app/globals.css`; the signature animations are plain CSS keyframes + Motion |
| Motion | **Motion** (`motion/react`) | Scroll reveals, the club → Epoch page transition, coin/QR result animations |
| Backend | **Supabase** (Postgres + GitHub OAuth) | Shared coin balances across every phone. Optional — see below |
| QR | `qrcode.react` (generate) + `html5-qrcode` (camera scan) | Wallet passes and stall codes |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Epoch works out of the box in **demo mode** (data lives in your browser's localStorage — register a few accounts and scan between them to try the flow).

## Make it yours

- Club content (events, tracks, team, FAQ, socials): [`lib/config.ts`](lib/config.ts)
- Epoch settings (ticket price, booths, recharge points, merch, schedule): [`lib/epoch/config.ts`](lib/epoch/config.ts)

Set `githubOrg` in `lib/config.ts` and the Projects section lists your real repos.

## Epoch: going live for the fest

1. Create a free project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor. All coin movement happens in database functions, so a tampered browser can't mint coins, and recharge points work once per attendee.
3. Enable **Authentication → Providers → GitHub**, with redirect URL `https://<your-domain>/epoch/register`.
4. Copy `.env.example` to `.env.local` and fill in the URL and anon key.
5. After you sign in once, make yourself admin: `update profiles set role = 'admin' where handle = 'your-handle';`
6. Open `/epoch/admin`, **print the QR sheet**, and put one code on each booth.

**Epoch mode:** the *EPOCH* item in the nav and the black-disc page transition are always there; the live dot and countdown follow `opensAt`/`closesAt`. Force it with `NEXT_PUBLIC_EPOCH_MODE=live|off`.

### How coins flow (from the original Epoch plan)

- **Ticket → coins.** ₹199 (working price) × 2 = **398 EPC**. The attendee registers, pays, then shows their wallet QR at the registration desk; an organiser scans it and presses *Verify ticket*. Coins are credited once — a second attempt is refused.
- **Spend booths** (`epoch:b:<id>`) charge coins per session (VR = 40) and can be repeated, with a 20-second double-scan guard.
- **Recharge points** pay **once per attendee, per point** (20 coins in the plan). The wallet shows how many are left.
- **Merch stall** sells tees, hoodies and stickers for coins; stock is decremented atomically.
- **Organiser desk** (`/epoch/admin`) prints the booth QR sheet; scanning a wallet also allows manual awards/deductions (competition prizes, refunds) with a reason in the ledger.
- Attendees see balance, full ledger and remaining recharge points, refreshed every few seconds.

> Only VR = 40 and the recharge reward = 20 come from the plan. Every other price, the ticket price and the recharge-point names are **placeholders** in `lib/epoch/config.ts` — confirm them.

`npm test` runs the economy rules against the demo store.

## Deploy

Push to GitHub and import the repo on [Vercel](https://vercel.com) (add the env vars there).

## Not affiliated

A student community project, not officially affiliated with GitHub, Inc.
