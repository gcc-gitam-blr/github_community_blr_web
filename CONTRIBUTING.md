# Contributing

This site is built by students, for students — and it's the club's own open-source project.
Your first pull request here counts just as much as one anywhere else.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:3000
```

No keys needed: without Supabase, Epoch runs in demo mode (data stays in your browser).

## Make a change

1. Find an issue (look for **good first issue**) or open one describing what you want to do.
2. Create a branch: `git checkout -b fix/short-description`
3. Keep commits small and focused — one idea per commit.
4. Before pushing:
   ```bash
   npm run lint
   npm test
   ```
5. Open a pull request. CI checks types, lint, tests and the build automatically.

## Where things live

| What | Where |
| --- | --- |
| Club content — events, recaps, team, FAQ, updates | `content/` (or the editor at `/keystatic`) |
| Epoch — dates, ticket, sponsors, schedule | `content/epoch/` (or `/keystatic`) |
| Epoch — coins, booths, merch | `lib/epoch/config.ts` (matches `supabase/schema.sql`) |
| Home page sections | `components/site/` |
| Epoch pages | `components/epoch/`, `app/epoch/` |
| Database (Supabase) | `supabase/schema.sql` |
| Tests | `tests/` |

## House rules

- **Real content only.** No made-up events, people, numbers or testimonials — empty sections hide themselves.
- **Phones first.** Most visitors are on a phone; check 375px wide.
- **Accessible.** Keyboard works, images have alt text (or `alt=""` if decorative), motion respects reduced-motion.
- Be kind in reviews. See the [Code of Conduct](CODE_OF_CONDUCT.md).
