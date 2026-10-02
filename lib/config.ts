/* ============================================================
   EDIT ME — everything the public site shows lives here.
   Epoch (the fest) has its own config in lib/epoch/config.ts.
   ============================================================ */

export type Shape = "diamond" | "square" | "ring" | "triangle";
export type NodeColor = "blue" | "purple" | "mint" | "green";

export const CLUB = {
  name: "GitHub Community Club BLR",
  university: "GITAM University Bengaluru",
  year: "2026-27",
  githubOrg: "github-community-gitam", // shows the Projects section with live repos
  githubUrl: "https://github.com",

  // Where "Join the club" sends people. Set ONE of these:
  //  - joinUrl: a Google Form / WhatsApp community / Linktree link (opens in a new tab)
  //  - email:   a real club address (opens a pre-filled email)
  // Until one is set the form says sign-ups aren't connected yet, instead of pretending to send.
  joinUrl: "https://chat.whatsapp.com/K1F5XOMfRavHEduanpxtSg", // the club WhatsApp community

  // After an event, add `recap: { text: "What happened…", slides: "https://…" }` to its entry to show a Recap on its page.
  // Events are published on Luma. Paste the club calendar link (e.g. "https://lu.ma/github-gitam")
  // to show "See all on Luma" buttons, and add `luma: "https://lu.ma/xyz"` to an event for its RSVP button.
  lumaCalendar: "https://luma.com/github_blr",
  lumaEpochCalendar: "https://luma.com/epoch-gitam-blr",
  email: "",

  // Only add real links. Empty = the footer hides the row.
  socials: [
    { label: "Instagram", href: "https://www.instagram.com/github.gitamblr/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/githubcommunitygitam/" },
    { label: "WhatsApp", href: "https://chat.whatsapp.com/K1F5XOMfRavHEduanpxtSg" },
  ] as { label: string; href: string }[],

  // A message shown above the site header (dismissible). Remove it, or let `until` pass, to hide it.
  // Example: { id: "git-merge", text: "GIT Merge 26 is this Monday — RSVP on Luma", href: "https://luma.com/iztx970g", from: "2026-10-05", until: "2026-10-12" }
  announcements: [] as { id: string; text: string; href?: string; from?: string; until?: string }[],

  // "What we do" on the About section
  whatWeDo: [
    { title: "Git & GitHub", text: "From your first commit to branches, pull requests and GitHub Actions — hands-on, at your own pace." },
    { title: "Open source", text: "Find beginner-friendly issues, make real contributions, and learn how open-source teams work together." },
    { title: "Workshops", text: "Practical sessions through the year: build and deploy projects, polish your profile, prepare for careers." },
  ],
  // shown as a `git diff --stat`; keep these to real numbers
  stats: [
    { value: 6, file: "events/2026-27.md", label: "Events in 2026-27" },
    { value: 21, file: "epoch/booths.md", label: "Booths at Epoch" },
    { value: 2, file: "epoch/days.md", label: "Days of Epoch" },
    { value: 398, file: "epoch/starter-coins", label: "Starter coins per attendee" },
  ],
  learn: [
    { id: "basics", cmd: "git init", shape: "diamond", color: "blue", title: "Git & GitHub basics", text: "Version control, repositories, and the everyday commands: init, add, commit, push, pull." },
    { id: "pr", cmd: "gh pr create", shape: "square", color: "purple", title: "Your first pull request", text: "Make a real contribution to a real project, with someone reviewing it alongside you." },
    { id: "portfolio", cmd: "git push origin main", shape: "ring", color: "mint", title: "Portfolio & READMEs", text: "Organise your repositories, write READMEs people read, and publish with GitHub Pages." },
    { id: "oss", cmd: "git merge upstream/main", shape: "triangle", color: "blue", title: "Open source", text: "Branching strategies, resolving merge conflicts and contributing to projects that aren't yours." },
    { id: "review", cmd: "gh pr review --approve", shape: "diamond", color: "purple", title: "Code review & CI", text: "Review code well, and use automated tests and checks to keep quality high." },
    { id: "career", cmd: "git tag v1.0.0", shape: "square", color: "mint", title: "GitHub for careers", text: "Use GitHub for internships, placements and a portfolio that speaks for you." },
  ] as { id: string; cmd: string; shape: Shape; color: NodeColor; title: string; text: string }[],
  events: [
    { date: "2026-10-07", type: "Workshop", title: "Learn GitHub & Make Your First Contribution", luma: "https://luma.com/exkd0eax", text: "Introduction to GitHub, repositories, commits, issues, pull requests — and your first contribution.", where: "GITAM Bengaluru", shape: "diamond", color: "blue" },
    { date: "2026-10-12", type: "Open Source", title: "GIT Merge 26", luma: "https://luma.com/iztx970g", text: "A GitHub and open-source event: learn Git, explore open source, make beginner-friendly contributions.", where: "GITAM Bengaluru", shape: "square", color: "purple" },
    { date: "2026-12-01", dateLabel: "December 2026", type: "Flagship", title: "EPOCH — GitHub Technical Month", luma: "https://luma.com/nxg57cad", text: "The club's major technical event: challenges, project development, presentations, a project showcase — and the Epoch Coins economy.", where: "GITAM Bengaluru", shape: "triangle", color: "mint", href: "/epoch" },
    { date: "2027-01-04", type: "Workshop", title: "Build & Deploy with GitHub", luma: "https://luma.com/d74xiz76", text: "Build a website, app or student project and publish it using GitHub and related tools.", where: "GITAM Bengaluru", shape: "ring", color: "blue" },
    { date: "2027-02-08", type: "Workshop", title: "GitHub Profile Makeover", luma: "https://luma.com/6y0tnxzm", text: "Level up your profile, READMEs, repositories and project presentation for academic and professional use.", where: "GITAM Bengaluru", shape: "diamond", color: "purple" },
    { date: "2027-03-15", type: "Career", title: "GitHub for Careers & Technical Challenge", luma: "https://luma.com/a1bfax1o", text: "How GitHub helps with internships, placements and portfolios — followed by a technical challenge.", where: "GITAM Bengaluru", shape: "square", color: "mint" },
  ] as { date: string; dateLabel?: string; href?: string; luma?: string; recap?: { text: string; slides?: string }; type: string; title: string; text: string; where: string; shape: Shape; color: NodeColor }[],
  // The core team. `photo` is a square image made by scripts/team-photos.mjs (photos-inbox/team → public/team).
  // `handle` is a GitHub username: it adds a link, and their GitHub avatar when there's no photo. Leave "" if unknown.
  // "mentor" people sit in the Mentors band at the top; "lead" and "tech" people each get a full card (leads first).
  // `past` is an optional second line under the role (e.g. a previous role).
  team: [
    { name: "Chakrawarthy", role: "Mentor · Tech & Design", past: "Former President", group: "mentor", handle: "lechakrawarthy" },
    { name: "Lakshmi", role: "Mentor · Operations", group: "mentor", handle: "" },
    { name: "Monisha S", role: "President", group: "lead", handle: "", photo: "/team/monisha-s.webp" },
    { name: "Dhigveerraju G", role: "Vice President", group: "lead", handle: "", photo: "/team/dhigveerraju-g.webp" },
    { name: "Supriya", role: "Secretary", group: "lead", handle: "" },
    { name: "T Sai Ruchitha", role: "Design Lead", group: "lead", handle: "", photo: "/team/t-sai-ruchitha.webp" },
    { name: "Chandrika", role: "External Relations Head", group: "lead", handle: "", photo: "/team/chandrika.webp" },
    { name: "Geethika", role: "Member of Technical Staff", group: "tech", handle: "", photo: "/team/geethika.webp" },
    { name: "Aravind K", role: "Member of Technical Staff", group: "tech", handle: "", photo: "/team/aravind-k.webp" },
    { name: "Vishnu Teja", role: "Member of Technical Staff", group: "tech", handle: "" },
    { name: "Venkat Madhu", role: "Member of Technical Staff", group: "tech", handle: "" },
    { name: "Bhavana", role: "Member of Technical Staff", group: "tech", handle: "" },
    { name: "Niharika", role: "Member of Technical Staff", group: "tech", handle: "" },
  ] as { name: string; role: string; group: "mentor" | "lead" | "tech"; handle: string; photo?: string; past?: string }[],
  // The people who built this website — shown like a repository's Contributors list. `handle` adds their GitHub avatar and link.
  contributors: [
    { name: "Chakrawarthy", handle: "lechakrawarthy" },
    { name: "Lakshmi", handle: "" },
    { name: "Rohit", handle: "" },
    { name: "Greeshmitha", handle: "" },
  ] as { name: string; handle: string }[],
  faq: [
    { q: "What is Epoch?", a: "Our flagship technical event in December: two days of workshops, coding competitions and 20+ interactive booths — run on its own currency, Epoch Coins." },
    { q: "How do Epoch Coins work?", a: "Everyone starts with 398 Epoch Coins, credited at check-in. Spend them at booths and on merch, and top up at recharge points. The ticket price (if any) hasn't been decided yet." },
    { q: "Can I earn more coins?", a: "Yes. Recharge points run mini-games — trivia, quick coding puzzles — worth around 20 coins. Each recharge point works once per person." },
    { q: "Do I need to know how to code?", a: "No. The year starts with a beginner session, Learn GitHub & Make Your First Contribution, and every event is built to be approachable." },
    { q: "How do I join, and where are events announced?", a: "Fill in the Join form on this page and hop into our WhatsApp community — that's where we share dates, workshops and RSVP links. Follow us on Instagram and LinkedIn too." },
    { q: "Who runs this?", a: "The GitHub Community Club at GITAM University Bengaluru — students organising for students." },
  ],
};

/** Short commit-style hash for an event. Used by the timeline and by the terminal's `git log`, so they match. */
export const commitHash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(7, "0").slice(0, 7); };
