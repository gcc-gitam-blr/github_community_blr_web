import { collection, config, fields, singleton } from "@keystatic/core";
import gallery from "./lib/gallery.json";
import memories from "./content/memories.json";
import { folderOptions } from "./scripts/photos-lib.mjs";

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
// photo folders already processed by scripts/photos.mjs: pick one instead of typing its name.
// Folders Memories still names but the gallery lacks stay listed (marked), or the editor would refuse to open Memories at all.
const FOLDERS = folderOptions(gallery, memories);
const folder = (label: string, description: string) => fields.select({ label, description, options: FOLDERS, defaultValue: "" });
const photo = fields.text({ label: "Photo", description: "Path of a processed photo, like /team/monisha-s.webp. New photos: a maintainer runs scripts/team-photos.mjs, which strips location data. Leave empty to use their GitHub avatar." });

export default config({
  storage: local ? { kind: "local" } : { kind: "github", repo: "lechakrawarthy/github_community_blr", branchPrefix: "content/" },
  ui: {
    brand: { name: "Club site" },
    navigation: { Club: ["settings", "announcements", "events", "updates", "team", "contributors", "challenge", "faq", "home", "memories"], Epoch: ["epoch", "schedule"] },
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
    challenge: singleton({
      label: "Contribution challenge", path: "content/club/challenge", format: { data: "json" },
      schema: {
        name: fields.text({ label: "Name", description: "Like October contribution challenge. Leave everything empty for no challenge." }),
        from: fields.date({ label: "First day", description: "Pull requests merged from this day (India time) count." }),
        to: fields.date({ label: "Last day", description: "…up to and including this day. The board shows the result for two weeks after." }),
        goal: fields.integer({ label: "Goal", description: "How many merged pull requests into other people's projects, like 4. Same counting as the board." }),
        description: fields.text({ label: "Short description", description: "One or two sentences: what it is, and what finishing it gets you (only if that's really decided).", multiline: true }),
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
    memories: singleton({
      label: "Memories", path: "content/memories", format: { data: "json" },
      schema: {
        cover: fields.object({
          folder: folder("Folder", "Empty uses the first photo of the newest year that has photos."),
          photo: fields.integer({ label: "Photo number", description: "1 is the first photo in the folder. Empty = 1." }),
        }, { label: "Opening photo", description: "The big photo at the top of the page." }),
        chapters: fields.array(fields.object({
          year: fields.text({ label: "Club year", description: "Like 2025-26. Who led that year is filled in from the team's Before lines (Former President, 2025-26).", ...req }),
          title: fields.text({ label: "Title", description: "A few words for the year. Empty shows just the year." }),
          story: fields.text({ label: "The story", description: "Two or three short paragraphs about the year, by someone who was there. Leave a blank line between paragraphs. Empty until you have it.", multiline: true }),
          started: fields.checkbox({ label: "The club started this year", description: "Marks the chapter as the initial commit." }),
          moments: fields.array(fields.object({
            title: fields.text({ label: "Title", description: "Like First session, or The night before Epoch.", ...req }),
            date: fields.date({ label: "Date" }),
            caption: fields.text({ label: "Caption", description: "A sentence or two: who, what, the thing everyone remembers.", multiline: true }),
            folder: folder("Photo folder", "Photos go in photos-inbox/<folder>/, then a maintainer runs node scripts/photos.mjs (README → Photos). New folders appear here after that."),
          }), { label: "Moments", description: "Groups of photos. The first three show; the rest fold away.", itemLabel: (p) => `${p.fields.date.value ?? ""} ${p.fields.title.value}`.trim() }),
          quotes: fields.array(fields.object({
            text: fields.text({ label: "What they said", multiline: true, ...req }),
            name: fields.text({ label: "Name", ...req }),
            role: fields.text({ label: "Who they are", description: "Like Member, first year. Optional." }),
          }), { label: "In their words", description: "Real words from members, shared with their permission. Optional.", itemLabel: (p) => p.fields.name.value }),
        }), { label: "Chapters", description: "One per club year. The page shows them oldest first.", itemLabel: (p) => `${p.fields.year.value}${p.fields.title.value ? " · " + p.fields.title.value : ""}` }),
        words: fields.object({
          intro: fields.text({ label: "Intro", description: "Under the big Memories title.", multiline: true }),
          thanks: fields.text({ label: "Thank-you text", description: "Under Thank you, above the names.", multiline: true }),
          missing: fields.text({ label: "Missing someone?", description: "The small line under the names: who to tell if a name is missing." }),
          nextTitle: fields.text({ label: "Closing heading", description: "The last box on the page, inviting the next member in." }),
          nextText: fields.text({ label: "Closing text", multiline: true }),
        }, { label: "Page words", description: "The page's own text. Empty puts the original words back." }),
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
        ticketUrl: fields.url({ label: "Registration form link", description: "Optional: a form people fill in before the day. Not for payment: tickets are paid at the registration desk." }),
        startsAt: fields.text({ label: "Starts at", description: "When the real date is announced, like 2026-12-11T09:00:00+05:30. The site then counts down. Empty = no countdown." }),
        opensAt: fields.text({ label: "Epoch section opens", description: "Like 2026-12-01T00:00:00+05:30.", ...req }),
        closesAt: fields.text({ label: "Epoch section closes", description: "Like 2026-12-31T23:59:59+05:30.", ...req }),
        sponsors: fields.array(fields.object({ name: fields.text({ label: "Name", ...req }), url: fields.url({ label: "Website", ...req }), logo: fields.text({ label: "Logo", description: "Path like /sponsors/acme.svg (optional)." }), tier: fields.text({ label: "Tier", description: "Gold, Silver… (optional)" }) }), { label: "Sponsors", itemLabel: (p) => p.fields.name.value }),
        contacts: fields.array(fields.object({ name: fields.text({ label: "Name", ...req }), role: fields.text({ label: "Call them for", description: "Like Registration desk and cash, or Coins and reversals." }), phone: fields.text({ label: "Phone", description: "Shown on the printed organiser guide, which is a public page. Use a number that's fine to share." }) }), { label: "Who organisers call on the day", description: "Shown in the organiser guide (/epoch/guide/organisers). Empty = the guide says to ask an admin.", itemLabel: (p) => p.fields.name.value }),
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
