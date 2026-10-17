# Site audit, October 2026

An honest look at the whole website and the admin system: how it looks, whether people can find their way, whether
members have a reason to come back, whether the organiser tools earn their place, and what helps the club grow.
Written for the core team. Every page was opened on a laptop and a phone, in light and dark mode, and the code
behind it was read. Section 9 lists what this audit changed; section 10 is what's left, in order.

---

## 1. The short version

- **The landing page is the best thing on the site.** It has a point of view: Git ideas made visual (the commit path,
  the year as a contribution graph, joining as a pull request), bold ink borders, and full-width colour bands that give
  the page a rhythm. Keep it.
- **The other pages didn't share that feeling.** They were all built the same way: a big headline, a sticker on
  the right, then thin grey cards on white, ending abruptly at the footer. They read like documentation, not like the
  same club. Nothing connected one page to the next.
- **Members had no reason, and almost no way, to sign in.** There was no sign-in in the header. My club, the project
  hub and the projects page weren't in the menu. My club itself was a list.
- **The organiser side is genuinely useful, but it was a row of 13 tabs to check one by one.** It now opens on
  one list of what needs you.
- **Certificates were one design for every event.** They are the thing people share most, so they are the club's
  best advert. Each event now has its own.
- **The contribution board was almost always empty**: it followed only the 2 people whose GitHub usernames were in
  the site's content.

## 2. Look and feel

| Finding | Severity | Status |
| --- | --- | --- |
| Inner pages lacked the landing page's rhythm (colour bands, Git diagrams, ink borders) | High | **Fixed**: one shared *path* across Learn → First pull request → Get merged → Build together, drawn like the landing page's commit path, with the current page marked HEAD; every page on it ends with a full-width "what's next" band in the landing page's colours |
| Pages ended without a next step | High | **Fixed**: the same bands on Learn, Contribute, Board, Projects and Updates |
| On phones, the "New · Epoch" pill covered the top line of the home hero | Medium | **Fixed** |
| In dark mode, warning text added with the admin tools stayed dark brown on a dark background | Medium | **Fixed** |
| The admin's Overview, Sign-ups, Messages and Feedback panels use Epoch's glassy style inside the GitHub-styled admin | Low | Left: they are shared with the Epoch desk; worth unifying when either is next touched |
| Lots of single-column white space on wide screens on Board, Projects and My club when there's no data | Low | Better now (bands, path, member card); goes away as real data arrives |

## 3. Finding your way (information architecture)

| Finding | Severity | Status |
| --- | --- | --- |
| No way to sign in from the header; members only saw "Join the club" | High | **Fixed**: *Sign in* (or your GitHub avatar once signed in) opens My club; the phone menu has the same |
| My club, the project hub and the projects page were reachable only from deep links | High | **Fixed**: My club is in the header; the hub and projects are linked from My club, the path, the board, the home projects section |
| Learn, Contribute, Board and Projects are steps of one journey but weren't presented that way | Medium | **Fixed**: the path on each page |
| The footer has 30+ links in four columns | Low | Fine for a footer; don't add more |

## 4. A reason to sign in (members)

My club is now a member home:

- **A member card**: events you came to, certificates, whether you're on the board, Epoch coins.
- **Your next event**, with the RSVP button.
- **Your year in the club**: every event as a square that lights up when you came. It's the home page's
  contribution graph, made personal.
- **A wall of certificates to collect**: one card per event in that event's colours. The ones you have open the
  certificate; the ones to come say "Come to earn this one". This turns attendance into a collection.
- **Build something together**, linking to the project hub, plus your merges and badges and your Epoch wallet.
- **Show me on the board**: members can now opt in to the public contribution board themselves (see section 7).

Signed out, the page shows what's inside instead of a single sentence.

## 5. Certificates

- **A design per event.** The colour of the spine, the node shape and the sticker come from the event itself (its
  timeline colour and shape in the content editor, and its kind: workshop, open source, careers). Epoch, the
  flagship, is gold. Under the name, a `git log` record: the event's commit and release tag, the author, "merged into
  main". Still one A4 landscape page when printed.
- **A share image.** A certificate link posted on LinkedIn or WhatsApp now shows a card with the name, the event
  and its colours, instead of a bare link.
- **Share buttons.** Besides *Add to LinkedIn profile*, there's *Post about it* (a LinkedIn post with that card)
  and *Share link*.
- **A sample gallery** at `/certificates/sample` on preview deployments (or locally with `CERT_SAMPLE=1`), so the team
  can check the designs before anyone is issued one. The live site never shows it.

## 6. The organiser side ("is it a Salesforce or Zoho?")

Honestly: no, and it shouldn't be. Salesforce and Zoho are built for sales teams of hundreds, with pipelines, automated
campaigns, dashboards and integrations. A 28-person student club would never use most of it, and unused features are
exactly what you said you don't want.

What the club has is a **club operations system** with the parts of a CRM that a club actually needs:

| CRM idea | What it is here |
| --- | --- |
| Contacts | Members, sign-ups, messages, attendance, and now **one member's history** in one place: events they came to, their access, their projects, what they're into |
| Pipeline | Recruitment rounds: new → screening → interview → decision → member |
| Activities and follow-ups | Tasks with owners and due dates, meetings with action items |
| Approvals | Event proposals, decided by a second person |
| Records that can't be quietly changed | Decisions, final minutes, policies, the activity log |
| Reminders | The Monday email: overdue tasks, access ending, assets without owners, policies to review |
| Engagement | The project hub, the board, certificates |

**What changed:** the admin now opens on **Needs you**, one list built from every tab: your overdue tasks, tasks due this
week, people asking to join your project, applications waiting for your review, projects asking to be featured, and
(for admins) proposals to decide, policy drafts waiting for a second admin, access ending soon, accounts without an
owner, and too few admins. Each line links straight to the place to act. On a quiet day it says so.

**Is every tab needed?** How often each one is used:

| Daily or weekly | Each term | Once a year | When something goes wrong |
| --- | --- | --- | --- |
| Needs you, Attendance & certificates, Sign-ups & email, Messages, Feedback, Members, Event proposals, Tasks, Projects | Recruitment, Meetings & decisions, People & roles | Assets & handover, Policies | Activity, Site errors |

They're grouped in the menu (Club, People, Work, Site) so the yearly ones don't get in the way. Don't add more tabs:
the next useful step is fewer clicks inside the ones that exist (section 10).

## 7. Growing the club (capturing an audience)

How people arrive, join, and come back, and what was done about each step:

1. **Arrive**: the home page, event pages (each with its own share card and calendar file), Luma, WhatsApp, Instagram.
   *New:* every certificate link shared on LinkedIn now carries its own card. With 30 to 60 people per event, that's
   the club's widest reach for free.
2. **Join**: the "pull request" join form on the home page (one step, welcome email, WhatsApp). It's good: keep it.
   *New:* every page on the path ends with a band pointing to the next step or to joining.
3. **Come back**: events (the calendar, the Monday digest for organisers), and now **My club** (collect the certificates,
   your year, your next event), the **project hub**, and the **board**, which members can opt in to themselves, so it
   no longer depends on someone editing the content.
4. **Belong**: the hub's interest survey shows the core team what members want to build, so the next club project
   is one people asked for.

What to watch each month: sign-ups, RSVP-to-attendance, certificates issued and shared, members on the board,
hub answers and ideas, and how many members sign in to My club.

## 8. Writing, accessibility, performance

- **Writing.** The copy was clear and friendly, but it leaned on em dashes, which are one of the clearest signs of
  machine-written text. About 40 sentences on the club pages, the FAQ, the events and the home page were rewritten with
  plain punctuation. Epoch keeps its own voice.
- **Accessibility.** Every row of tabs (admin, hub, gallery, Epoch booths and plan) now works from the keyboard: the
  arrow keys move between tabs, Home and End jump to the ends, and only the selected tab is a Tab stop. The automated
  accessibility checks (WCAG A and AA, light and dark) cover the new public pages too.
- **Performance.** Lighthouse runs in CI on every pull request with a 0.95 accessibility floor and performance budgets.
  The new sign-in check in the header loads only after the page has settled, so it never slows the first paint.

## 9. What this audit changed

Org link fixed (`gcc-gitam-blr`) · the path and the "what's next" bands · Sign in / avatar in the header · My club as a
member home · certificates per event, share card, share buttons, sample gallery · Needs you · one member's history ·
the board opt-in · featured member projects on the home page · tabs from the keyboard · dark-mode and phone fixes ·
the writing pass. Every change has its tests, and the full suite passes.

## 10. What's left, in order

1. **Fill in the real content** (needs the team, not code):
   - add the GitHub username of every team member in the content editor (most don't have one, which is why the board
     followed only 2 people);
   - give the `gcc-gitam-blr/github_community_blr_web` repository a one-line description on GitHub (the home page shows
     "No description yet");
   - photos for Memories and the gallery, after each event;
   - ask members to sign in to My club, fill in "What I'm into" in the hub, and tick *Show me on the board*.
2. **Use it for one month, then look at the activity log** (Admin → Activity): which tabs nobody touched? Hide or
   merge those rather than adding new ones.
3. **Unify the admin's Overview, Sign-ups, Messages and Feedback panels** with the rest of the admin style.
4. **Email nudges for members** (optional): "your certificate is ready", "someone asked to join your project". These
   are the two moments most likely to bring someone back. Only worth it once members actually use the hub.
5. **Revisit the six-month question for the first round of recruitment**: applications still open after a round
   closes are not deleted automatically.
