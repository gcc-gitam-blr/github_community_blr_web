# GitHub Community Club BLR

The official website of the GitHub Community Club, Bengaluru — **Learn. Build. Merge.**

Zero dependencies, zero build step. Plain HTML, CSS and JavaScript, so anyone in the club can read it, fork it and open a pull request.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Make it yours

Everything the site displays lives in one file: [`js/config.js`](js/config.js).

| What | Where |
| --- | --- |
| Org name, socials, contact email | `githubOrg`, `socials`, `email` |
| Member / repo / event counts | `stats` |
| Events timeline | `events` |
| Core team (avatars load from `handle`) | `team` |
| Sign-up form destination | `formEndpoint` ([Formspree](https://formspree.io) etc.) |

Set `githubOrg` and the **Projects** section pulls your latest repos live from GitHub.

## Deploy

Push to GitHub, then **Settings → Pages → Deploy from branch → `main` / root**.

## Contributing

1. Fork, then `git checkout -b feat/your-idea`
2. Commit small and often
3. Open a pull request — every merge earns a place on the timeline

## Not affiliated

This is a student community project and is not officially affiliated with GitHub, Inc.
