# The club's admin system: a guide for the team

This is the plain-language guide to everything under **`/admin`**: who can do what, how each part works, and what to do
when something goes wrong. It is written for the core team, not for programmers. (Programmers: `supabase/schema.sql` is
the single source of truth, and `tests/` proves every rule below.)

It is deliberately small. It does the few things a 28-person club needs: **who has access, who is in the club, who we
recruit, which events are approved, who owns which task, what we decided, who holds which account, and what our rules
are.** It is not a replacement for WhatsApp, Luma or a spreadsheet.

---

## 1. The one idea: the database decides

Everything on these pages is checked **in the database**, not on the page. A hidden button is only a convenience: if you
could somehow press it, the database would still say no. That is why the rules below can be trusted, and why every rule
has an automated test that tries it as the wrong person.

Everything that changes is also written to an **activity log** (`/admin` → Activity, admins only). It records who did what
and when, using ids and states, never the text people wrote. Nobody can edit or delete a line of it.

## 2. Who can do what

Every role is an **appointment**: a role, a start date and an **end date**. Access stops by itself on the end date (India
time), on the very next page load. Nobody has to remember to remove it.

| Role | Who | Can |
| --- | --- | --- |
| **Volunteer** | Event-day staff | Mark attendance, check people in at the Epoch desk, scan at their booth. Cannot read sign-ups, messages or feedback. |
| **Core** | The core team | Everything a volunteer can, plus read sign-ups, messages, feedback, members, events, tasks, meetings, decisions, assets and policies; propose events; create tasks and meetings; review applications they are assigned to. |
| **Admin** | President / vice-president level | Everything, plus: change who has access, run recruitment, approve events, record decisions, edit assets, run the handover, publish policies, read the activity log. |
| *No access* | Everyone else (including attendees) | Sees "ask an admin". |

Rules that never bend:
- Only admins change who has access. **Nobody changes their own.**
- The last active admin cannot be removed, and the Monday email warns when **fewer than two** admins are active. Keep at least two, always.
- An admin never approves their own event proposal, application or policy: a **second** person does.

**First admin / locked out?** In the Supabase SQL editor, after the person has signed in at `/admin` once:
`select bootstrap_admin('their-github-username', '2027-04-30');` (the day their access ends).

## 3. The tabs

The menu is grouped: **Club** (Overview, Attendance & certificates, Sign-ups & email, Messages, Feedback), **People**
(Members, Recruitment, Projects, People & roles), **Work** (Event proposals, Tasks, Meetings & decisions, Assets & handover, Policies)
and **Site** (Activity, Site errors, admins only). Volunteers see only the ones they can use.

### People & roles
Give someone access by GitHub username: pick a role, an optional title (President, Events lead…) and **the day it ends**.
The same form changes a role or extends a term; **End access** removes it early. Someone who hasn't signed in yet gets it
the first time they do. The page warns when fewer than two admins are active, and shows who is ending soon in amber.

### Members
The club's people: name, email, GitHub username, team, dates, and active / alumni / inactive. Admins add, edit, change
status, and **import a spreadsheet** (a CSV with `name` and `email`, optionally `handle`, `team`, `joined_on`). The import
is checked first: if any row is wrong, **nothing** is saved and you are told which rows. Downloads are logged.

### Recruitment
1. An admin creates a **round** (name, club year, the dates applications are accepted) and adds **reviewers** (people with a
   core or admin appointment). Only then, **opens** it.
2. While a round is open, **Get involved → Join the core team** shows the application form (name, email, GitHub, preferred
   team, two short answers). When no round is open it says applications are closed.
3. Only the round's reviewers and admins can read applications. A reviewer sees only their own scores. **Nobody can review,
   decide or onboard their own application.**
4. An application goes **New → Screening → Interview**; then an admin **selects, waitlists or declines** it, with a reason.
   A selected applicant is **onboarded**, which creates a member (and nothing else: access is a separate, deliberate step).
5. Declined and withdrawn applications are deleted 6 months after the round closes.

### Event proposals
Every event starts as a proposal: title, kind, date, venue, goal, expected attendance, an optional budget, and a checklist
(venue, permission, budget source, volunteers and an attendance plan are **required**; the registration page, announcement
and recap owner are optional). The proposer submits it; an admin who is **not** the proposer approves, returns or rejects it
(a reason is required to return or reject). Approval is **refused while a required item is open**: each must be done, or
marked "not needed" with a reason. After the event, the proposer records the outcome and links the attendance (or says why
there is none).
> **Limit:** event pages are published by a save in the content editor, which the database can't hold back. So publish an
> event only after you see it approved here. Each event in the editor has a *Proposal number*, and `npm run check:events`
> (also shown in CI as a warning) lists upcoming events without one.

### Tasks
One owner and a due date from the start. The owner must hold a core or admin appointment. The owner, creator or an admin
moves a task along; only the creator or an admin changes the owner or date. The tab shows one group at a time (mine,
overdue, all open, finished). If an owner's access ends, their open tasks are flagged to be reassigned.

### Meetings & decisions
A meeting has an agenda, who was there and minutes. The creator (or an admin) edits the minutes until they **finalise**
them; after that they **never change**: a correction is a note beside them. Action items are tasks that point at the
meeting. **Decisions are only ever added.** To change one, an admin records a new decision that **supersedes** it, and both
stay in the register.

### Assets & handover
The **registry** lists where each of the club's accounts lives (domain, Vercel, Supabase, GitHub, Gmail, Luma, WhatsApp,
Instagram…) with an **owner** and a different **backup**. It warns about missing owners or backups, owners whose access is
ending, and overdue reviews. **Never put a password or key there**: write where it is kept. The database refuses text that
looks like a secret (a safety net, not a guarantee).
The **handover checklist** is the new-team list from [ROLLOVER.md](ROLLOVER.md), ticked here once a year. It can only be
completed when every step is done or waived with a reason.

### Policies
The club's own rules, as versions. One admin writes a draft; a **different** admin approves and publishes it. A published
version is **never edited**: a change is a new version, and the old ones stay. Nothing is pre-filled: the club writes them.

### Projects (and the member project hub)
Members open **`/hub`** (signed in with GitHub; active members and the core team only) to: say which areas they like and what
they'd build (**What I'm into**), browse and share **Project ideas** and ask to join a team, **Find people** by area or skill,
and manage **My teams** (answer requests, move a project from idea to shipped, choose whether their GitHub name shows publicly).
Survey answers are private: the core team sees them in **Admin → Projects → What members like** to choose a **club project**
everyone can join; other members see only counts (hidden where fewer than 3 people share one) and the people who ticked
"let teammates find me". A team that wants to be on the website asks; a core or admin member who is **not** its owner reviews
it in **Admin → Projects → To feature**. Only then does it appear on `/projects`, with GitHub names only for members who
agreed. Editing a featured project sends it back for review.

### Activity
The log of everything above, newest first, searchable. Use it to answer "who changed this, and when?".

## 4. The Monday email

Every Monday at 9:00 India time the organisers get a short email, only when something needs attention:
new sign-ups, messages and feedback, **fewer than two active admins**, **access ending within 14 days**, **overdue tasks**,
**tasks whose owner lost access**, **assets that need an owner, a backup or a review**, and **policies past their review date**.
A quiet week sends nothing.

## 5. How long we keep things

| What | Kept |
| --- | --- |
| Sign-ups | 18 months |
| Messages, event feedback | 12 months |
| Declined or withdrawn applications | 6 months after the round closes |
| Members who became inactive | 24 months (active members and alumni are kept) |
| The activity log | 36 months |
| Browser error reports | 30 days |
| Project hub answers | while the person is a member or on the core team; they can delete them any time |
| Meetings, minutes, decisions, policies, tasks, assets, project ideas | kept |

A weekly job deletes old data. The numbers live in `lib/retention.ts` and `/privacy` quotes the same ones.

## 6. Honest limits

- The database cannot stop an event page being published early (see Event proposals).
- Access ends on a date. It does not notice someone who has left the club mid-term: **end their access early.**
- Anyone with Supabase or the service key can alter data directly. Protect those accounts: two people, two-factor sign-in,
  and rotate keys when people leave ([ROLLOVER.md](ROLLOVER.md)).
- Applications still "New / Screening / Interview" after a round closes are not deleted automatically: finish them.
- Grievances and discipline do **not** belong here. Don't store allegations or evidence in this system.

## 7. Applying an update (for whoever maintains the site)

1. Merge the pull requests **in order**, oldest first (each says what it needs).
2. In the Supabase SQL editor, re-run `supabase/schema.sql` (safe to repeat).
3. The first time only: set your end date in `supabase/backfill-appointments.sql` and run it, so existing organisers keep
   access as appointments.
4. Open `/admin` and look at each new tab.

Questions about a rule? The test for it is in `tests/` and says it in a sentence.
