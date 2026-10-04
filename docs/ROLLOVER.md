# New club year: handing the site over

For whoever runs the site in 2027-28 (and every year after). Most of it happens in the **content editor**:
open `https://<the site>/keystatic`, sign in with GitHub, change things, press **Save**. The site
updates itself a minute or two later. Set aside an evening; nothing here needs code.

Do the steps in order. Tick them off in a GitHub issue so the next team can see what was done.

## 1. Get the keys

Before the old team leaves, make sure the new leads have their own access to:

- **GitHub**: the repository (and the club's GitHub organisation), as maintainers.
- **Vercel**: the project, as members.
- **Supabase**: the project, as members.
- **The club Gmail** (or Resend) that sends the emails, and **Luma**, **WhatsApp**, **Instagram**.
- **The site's admin pages**: an old admin signs the new leads in once at `/admin`, then gives them the
  *admin* role under **People & roles**.

## 2. The club year

Content editor → **Club settings**:

- **Club year**: change `2026-27` to `2027-28`.
- Check the **Join link**, **Club email**, **Luma calendars** and **Social links** still work. An empty
  box hides that thing; never leave an old link in.

## 3. The team

Content editor → **Team**. For everyone leaving the core team, decide with them:

- **Staying on as a mentor**: change **Row** to *Mentors* and fill **Before** with what they did, like
  `President, 2026-27`. Memories uses these lines to show who led each year, so write the role and the year.
- **Moving on**: remove them from Team and add them under **Contributors** (people who've shaped the
  club), so they are still thanked.

Then add the new leads (Row: *Leads*) and members. Photos are optional: without one the site uses their
GitHub avatar. A maintainer adds real photos with `node scripts/team-photos.mjs`, which strips location data.
Only add people who agreed to be on the site.

## 4. Events

Content editor → **Events**:

- **Keep last year's events.** Past events stay on the site with their recaps; don't delete them.
- Add the new year's events. If a date isn't fixed, set a rough date and a **Date label** like
  `January 2028`.
- Home page blocks → **Numbers**: only real numbers you can count, with a file name like `events/2027-28.md`.
- **Announcements**: remove the old ones; add one for the first event if you like.
- **Updates**: write a short post welcoming the new team. Posts are kept as a record, so don't delete old ones.

## 5. Epoch

Content editor → **Epoch settings**:

- **Month**, **Dates**, **Venue**: as announced. Until dates are fixed, say so (`dates to be announced`).
- **Starts at**, **Epoch section opens**, **Epoch section closes**: the new dates, written like
  `2027-12-10T09:00:00+05:30` (the `+05:30` is India time).
- **Ticket price** and **Ticket link**: empty until decided.
- **Sponsors**: remove last year's unless they've signed again.

Content editor → **Epoch schedule**: replace the sessions.

**Clear last year's Epoch data.** The privacy page promises it is deleted within 6 months after the fest.
In Supabase → SQL Editor, run:

```sql
delete from txs;                                                  -- everyone's coin history
update profiles set coins = 0, earned = 0, ticket = false;        -- organisers start at zero too
delete from auth.users where id in (select id from profiles where role = 'attendee'); -- attendees' sign-ins
```

Organisers and volunteers keep their accounts and roles. Booths and rewards stay (edit them on `/epoch/admin`).

## 6. Memories

Every year gets its own chapter on `/memories`:

1. Put each moment's photos in its own folder, `photos-inbox/<moment>/`. Only photos of people who agreed.
2. A maintainer runs `node scripts/photos.mjs` and commits `public/gallery` and `lib/gallery.json`.
3. Content editor → **Memories**: add the year (2026-27), its story, and its moments with their photo folders.

Who led the year comes from the team's **Before** lines (step 3), so there is nothing else to type.

## 7. Change the secrets

People who leave may still know the passwords. Change these, then **Redeploy** in Vercel
(Deployments → the latest → ⋯ → Redeploy):

| What | Where to make a new one | Where it goes |
| --- | --- | --- |
| Gmail app password (`SMTP_PASS`) | myaccount.google.com/apppasswords: delete the old one, create a new one | Vercel |
| `CRON_SECRET` | Any long random text | Vercel |
| `RATE_LIMIT_SALT` | Any long random text | Vercel |
| `GITHUB_CLIENT_SECRET` | github.com/settings/developers → the OAuth App → Generate a new client secret, delete the old one | Vercel, and Supabase → Authentication → GitHub for the other OAuth App |
| Database password (`SUPABASE_DB_URL`) | Supabase → Project Settings → Database → Reset password | GitHub → Settings → Secrets → Actions, and your own `.env.local` |
| `BACKUP_PASSPHRASE` (if used) | Any long random text | GitHub secrets. Backups made before still need the old one, so keep it 30 days |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys: create a new secret key, then delete the old one | Vercel |

Leave `EMAIL_SECRET` alone unless it leaked: changing it breaks the unsubscribe links in every email already sent.
Make a random value with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Last, remove people who left from GitHub, Vercel, Supabase and the club Gmail, and take away their role
under `/admin` → **People & roles**.

## 8. Check it

- Open the home page, an event page, `/epoch` and `/privacy` on a phone.
- The **Actions** tab on GitHub: CI, Backup and Uptime should be green. If a "Site is down" issue is open, the
  site isn't answering.
- Update the **Last updated** date on the privacy page if anything about what we collect changed.
