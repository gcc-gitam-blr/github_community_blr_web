import { collection, config, fields, singleton } from "@keystatic/core";

/* The content editor at /keystatic: forms for everything the site shows, saved as files in content/.
   Locally (npm run dev) it saves straight to your files. On the live site it signs editors in with GitHub
   and every save is a commit (or a pull request, if they pick a branch) — so there's history, review and undo.
   Epoch booths, coin prices and the shop stay in lib/epoch/config.ts: the database seeds them too, and both must match. */

// NEXT_PUBLIC_KEYSTATIC_GITHUB=1 uses GitHub locally too (needed once, to create the GitHub App — see README)
const local = (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB !== "1") || process.env.NEXT_PUBLIC_KEYSTATIC_LOCAL === "1";

const SHAPES = [{ label: "Diamond", value: "diamond" }, { label: "Square", value: "square" }, { label: "Ring", value: "ring" }, { label: "Triangle", value: "triangle" }] as const;
const COLORS = [{ label: "Blue", value: "blue" }, { label: "Purple", value: "purple" }, { label: "Mint", value: "mint" }, { label: "Green", value: "green" }] as const;
const CREW = ["custodian", "gatekeeper", "scout", "pipeline", "security", "alchemist", "explorer", "forge"].map((v) => ({ label: v[0].toUpperCase() + v.slice(1), value: v }));
const req = { validation: { isRequired: true } } as const;
const photo = fields.text({ label: "Photo", description: "Path of a processed photo, like /team/monisha-s.webp. New photos: a maintainer runs scripts/team-photos.mjs, which strips location data. Leave empty to use their GitHub avatar." });

export default config({
  storage: local ? { kind: "local" } : { kind: "github", repo: "lechakrawarthy/github_community_blr", branchPrefix: "content/" },
  ui: {
    brand: { name: "Club site" },
    navigation: { Club: ["settings", "announcements", "events", "updates", "team", "contributors", "faq", "home"], Epoch: ["epoch", "schedule"] },
  },
  collections: {
    updates: collection({
      label: "Updates", path: "content/updates/*", slugField: "title", format: { contentField: "body" },
      entryLayout: "content", columns: ["title", "date"],
      schema: {
        title: fields.slug({ name: { label: "Title", ...req }, slug: { label: "Web address", description: "The end of the page's URL. Set once; changing it breaks shared links." } }),
        date: fields.date({ label: "Date", ...req }),
        tag: fields.text({ label: "Tag", description: "One word shown as a label, like Events or Website." }),
        summary: fields.text({ label: "Summary", description: "One or two sentences for the list, the home page and RSS.", multiline: true, ...req }),
        order: fields.integer({ label: "Order", description: "Only for posts on the same day: higher shows first." }),
        body: fields.markdoc({ label: "Post", extension: "md" }),
      },
    }),
  },
  singletons: {
    settings: singleton({
      label: "Club settings", path: "content/club/settings", format: { data: "json" },
      schema: {
        name: fields.text({ label: "Club name", ...req }),
        university: fields.text({ label: "University", ...req }),
        year: fields.text({ label: "Club year", description: "Like 2026-27.", ...req }),
        githubOrg: fields.text({ label: "GitHub organisation", description: "Its login, like github-community-gitam. Shows its live repos and beginner issues. Empty hides them." }),
        joinUrl: fields.url({ label: "Join link", description: "Where Join the club sends people: the WhatsApp community, a form…" }),
        email: fields.text({ label: "Club email", description: "Shown in the footer and on the privacy page. Only a real, monitored address." }),
        lumaCalendar: fields.url({ label: "Luma calendar (club)" }),
        lumaEpochCalendar: fields.url({ label: "Luma calendar (Epoch)" }),
        socials: fields.array(fields.object({ label: fields.text({ label: "Name", description: "Instagram, LinkedIn…", ...req }), href: fields.url({ label: "Link", ...req }) }), { label: "Social links", itemLabel: (p) => p.fields.label.value }),
      },
    }),
    announcements: singleton({
      label: "Announcements", path: "content/club/announcements", format: { data: "json" },
      schema: {
        announcements: fields.array(fields.object({
          id: fields.text({ label: "ID", description: "A short name, unique per announcement (like git-merge). Someone who closes it won't see it again.", ...req }),
          text: fields.text({ label: "Message", ...req }),
          href: fields.text({ label: "Link", description: "Optional: a page on this site (/events/…) or a full https:// link." }),
          from: fields.date({ label: "Show from" }),
          until: fields.date({ label: "Show until", description: "After this day it hides itself." }),
        }), { label: "The bar above the header", itemLabel: (p) => p.fields.text.value }),
      },
    }),
    events: singleton({
      label: "Events", path: "content/club/events", format: { data: "json" },
      schema: {
        events: fields.array(fields.object({
          title: fields.text({ label: "Title", description: "Also makes the page address, so avoid renaming after sharing.", ...req }),
          date: fields.date({ label: "Date", ...req }),
          dateLabel: fields.text({ label: "Date label", description: "Instead of the exact date while it isn't announced, like December 2026." }),
          type: fields.text({ label: "Type", description: "Workshop, Open Source, Career…", ...req }),
          text: fields.text({ label: "Description", multiline: true, ...req }),
          where: fields.text({ label: "Where", defaultValue: "GITAM Bengaluru", ...req }),
          luma: fields.url({ label: "Luma RSVP link" }),
          href: fields.text({ label: "Own section", description: "Only for Epoch: /epoch." }),
          shape: fields.select({ label: "Timeline shape", options: SHAPES, defaultValue: "diamond" }),
          color: fields.select({ label: "Timeline colour", options: COLORS, defaultValue: "blue" }),
          recap: fields.object({
            text: fields.text({ label: "What happened", description: "Two or three short paragraphs. Empty = no recap yet.", multiline: true }),
            numbers: fields.array(fields.object({ value: fields.integer({ label: "Number", ...req }), label: fields.text({ label: "Label", description: "came, first pull requests, mentors…", ...req }) }), { label: "Numbers", itemLabel: (p) => `${p.fields.value.value ?? ""} ${p.fields.label.value}` }),
            video: fields.url({ label: "Video", description: "A YouTube link plays on the page; any other link (Instagram…) shows as a button." }),
            slides: fields.url({ label: "Slides and materials" }),
            photos: fields.text({ label: "Photo folder", description: "Only if the gallery folder isn't named after the event." }),
          }, { label: "Recap (after the event)" }),
        }), { label: "Events", itemLabel: (p) => `${p.fields.date.value ?? ""} · ${p.fields.title.value}` }),
      },
    }),
    team: singleton({
      label: "Team", path: "content/club/team", format: { data: "json" },
      schema: {
        team: fields.array(fields.object({
          name: fields.text({ label: "Name", ...req }),
          group: fields.select({ label: "Row", options: [{ label: "Mentors", value: "mentor" }, { label: "Leads (top row of five)", value: "lead" }, { label: "Members", value: "member" }], defaultValue: "member" }),
          role: fields.text({ label: "Title", description: "President, Design Lead, Mentor · Operations…" }),
          past: fields.text({ label: "Before", description: "For mentors: Former President, 2024-25…" }),
          owner: fields.checkbox({ label: "Runs operations and policy (mentors only)" }),
          crew: fields.array(fields.object({ role: fields.select({ label: "Crew role", options: CREW, defaultValue: "custodian" }), level: fields.select({ label: "Level", options: [{ label: "I", value: "1" }, { label: "II", value: "2" }, { label: "III", value: "3" }], defaultValue: "1" }) }), { label: "Crew roles", description: "lib/crew.ts explains each role.", itemLabel: (p) => `${p.fields.role.value} ${"I".repeat(Number(p.fields.level.value))}` }),
          tags: fields.array(fields.text({ label: "Tag" }), { label: "Extra hats", description: "Tech, Media…", itemLabel: (p) => p.value }),
          handle: fields.text({ label: "GitHub username", description: "Without the @. Adds a link, their avatar, and the contribution board." }),
          photo,
          githubAvatar: fields.checkbox({ label: "Use their GitHub avatar when there's no photo", description: "Untick if their GitHub picture is still the default pattern.", defaultValue: true }),
        }), { label: "Team", itemLabel: (p) => `${p.fields.name.value}${p.fields.role.value ? " · " + p.fields.role.value : ""}` }),
      },
    }),
    contributors: singleton({
      label: "Contributors", path: "content/club/contributors", format: { data: "json" },
      schema: {
        contributors: fields.array(fields.object({
          name: fields.text({ label: "Name", ...req }),
          handle: fields.text({ label: "GitHub username", description: "Without the @." }),
          photo,
          githubAvatar: fields.checkbox({ label: "Use their GitHub avatar when there's no photo", defaultValue: true }),
        }), { label: "People who've shaped the club", itemLabel: (p) => p.fields.name.value }),
      },
    }),
    faq: singleton({
      label: "FAQ", path: "content/club/faq", format: { data: "json" },
      schema: { faq: fields.array(fields.object({ q: fields.text({ label: "Question", ...req }), a: fields.text({ label: "Answer", multiline: true, ...req }) }), { label: "Questions", itemLabel: (p) => p.fields.q.value }) },
    }),
    home: singleton({
      label: "Home page blocks", path: "content/club/home", format: { data: "json" },
      schema: {
        whatWeDo: fields.array(fields.object({ title: fields.text({ label: "Title", ...req }), text: fields.text({ label: "Text", multiline: true, ...req }) }), { label: "What we do", itemLabel: (p) => p.fields.title.value }),
        stats: fields.array(fields.object({ value: fields.integer({ label: "Number", ...req }), file: fields.text({ label: "File name shown", description: "Like events/2026-27.md.", ...req }), label: fields.text({ label: "Label", ...req }) }), { label: "Numbers", description: "Keep these to real numbers.", itemLabel: (p) => `${p.fields.value.value ?? ""} ${p.fields.label.value}` }),
        learn: fields.array(fields.object({
          id: fields.text({ label: "ID", ...req }), cmd: fields.text({ label: "Command shown", description: "Like git init.", ...req }),
          title: fields.text({ label: "Title", ...req }), text: fields.text({ label: "Text", multiline: true, ...req }),
          shape: fields.select({ label: "Shape", options: SHAPES, defaultValue: "diamond" }), color: fields.select({ label: "Colour", options: COLORS, defaultValue: "blue" }),
        }), { label: "What you'll learn", itemLabel: (p) => p.fields.title.value }),
      },
    }),
    epoch: singleton({
      label: "Epoch settings", path: "content/epoch/settings", format: { data: "json" },
      schema: {
        tagline: fields.text({ label: "Tagline", ...req }),
        month: fields.text({ label: "Month", description: "Like December 2026.", ...req }),
        dates: fields.text({ label: "Dates", description: "As shown: December 2026 · dates to be announced.", ...req }),
        venue: fields.text({ label: "Venue", ...req }),
        ticketPriceINR: fields.integer({ label: "Ticket price (₹)", description: "Empty until decided; the site then says To be announced." }),
        ticketUrl: fields.url({ label: "Ticket link", description: "A payment or registration link. Empty = pay at the desk." }),
        startsAt: fields.text({ label: "Starts at", description: "When the real date is announced, like 2026-12-11T09:00:00+05:30. The site then counts down. Empty = no countdown." }),
        opensAt: fields.text({ label: "Epoch section opens", description: "Like 2026-12-01T00:00:00+05:30.", ...req }),
        closesAt: fields.text({ label: "Epoch section closes", description: "Like 2026-12-31T23:59:59+05:30.", ...req }),
        sponsors: fields.array(fields.object({ name: fields.text({ label: "Name", ...req }), url: fields.url({ label: "Website", ...req }), logo: fields.text({ label: "Logo", description: "Path like /sponsors/acme.svg (optional)." }), tier: fields.text({ label: "Tier", description: "Gold, Silver… (optional)" }) }), { label: "Sponsors", itemLabel: (p) => p.fields.name.value }),
      },
    }),
    schedule: singleton({
      label: "Epoch schedule", path: "content/epoch/schedule", format: { data: "json" },
      schema: {
        days: fields.array(fields.object({
          day: fields.select({ label: "Day", options: [{ label: "Day 1", value: "1" }, { label: "Day 2", value: "2" }], defaultValue: "1" }),
          label: fields.text({ label: "Label", ...req }),
          items: fields.array(fields.object({
            time: fields.text({ label: "Starts", description: "24-hour, like 08:30.", ...req }), end: fields.text({ label: "Ends" }),
            title: fields.text({ label: "Title", ...req }),
            kind: fields.select({ label: "Kind", options: ["Ceremony", "Workshop", "Competition", "Booths", "Talk", "Break"].map((v) => ({ label: v, value: v })), defaultValue: "Workshop" }),
            notes: fields.array(fields.text({ label: "Note" }), { label: "Notes", itemLabel: (p) => p.value }),
          }), { label: "Sessions", itemLabel: (p) => `${p.fields.time.value} ${p.fields.title.value}` }),
        }), { label: "Days", itemLabel: (p) => p.fields.label.value }),
      },
    }),
  },
});
