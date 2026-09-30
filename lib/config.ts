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

  // Events are published on Luma. Paste the club calendar link (e.g. "https://lu.ma/github-gitam")
  // to show "See all on Luma" buttons, and add `luma: "https://lu.ma/xyz"` to an event for its RSVP button.
  lumaCalendar: "",
  email: "",

  // Only add real links. Empty = the footer hides the row.
  socials: [
    { label: "Instagram", href: "https://www.instagram.com/github.gitamblr/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/githubcommunitygitam/" },
    { label: "WhatsApp", href: "https://chat.whatsapp.com/K1F5XOMfRavHEduanpxtSg" },
  ] as { label: string; href: string }[],

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
    { value: 398, file: "epoch/coins-per-ticket", label: "Coins per ₹199 ticket" },
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
    { date: "2026-10-05", type: "Workshop", title: "Learn GitHub & Make Your First Contribution", text: "Introduction to GitHub, repositories, commits, issues, pull requests — and your first contribution.", where: "GITAM Bengaluru", shape: "diamond", color: "blue" },
    { date: "2026-10-12", type: "Open Source", title: "GIT Merge 26", text: "A GitHub and open-source event: learn Git, explore open source, make beginner-friendly contributions.", where: "GITAM Bengaluru", shape: "square", color: "purple" },
    { date: "2026-12-01", dateLabel: "December 2026", type: "Flagship", title: "EPOCH — GitHub Technical Month", text: "The club's major technical event: challenges, project development, presentations, a project showcase — and the Epoch Coins economy.", where: "GITAM Bengaluru", shape: "triangle", color: "mint", href: "/epoch" },
    { date: "2027-01-04", type: "Workshop", title: "Build & Deploy with GitHub", text: "Build a website, app or student project and publish it using GitHub and related tools.", where: "GITAM Bengaluru", shape: "ring", color: "blue" },
    { date: "2027-02-08", type: "Workshop", title: "GitHub Profile Makeover", text: "Level up your profile, READMEs, repositories and project presentation for academic and professional use.", where: "GITAM Bengaluru", shape: "diamond", color: "purple" },
    { date: "2027-03-15", type: "Career", title: "GitHub for Careers & Technical Challenge", text: "How GitHub helps with internships, placements and portfolios — followed by a technical challenge.", where: "GITAM Bengaluru", shape: "square", color: "mint" },
  ] as { date: string; dateLabel?: string; href?: string; luma?: string; type: string; title: string; text: string; where: string; shape: Shape; color: NodeColor }[],
  team: [] as { role: string; handle: string; note: string }[], // add real people: { role: "Club Lead", handle: "github-handle", note: "…" }
  faq: [
    { q: "What is Epoch?", a: "Our flagship technical event in December: two days of workshops, coding competitions and 20+ interactive booths — run on its own currency, Epoch Coins." },
    { q: "How do Epoch Coins work?", a: "Your ticket converts to coins at 1 ₹ = 2 coins (₹199 → 398 coins, final price to be announced). Spend them at booths and on merch, and top up at recharge points." },
    { q: "Can I earn more coins?", a: "Yes. Recharge points run mini-games — trivia, quick coding puzzles — worth around 20 coins. Each recharge point works once per person." },
    { q: "Do I need to know how to code?", a: "No. The year starts with a beginner session, Learn GitHub & Make Your First Contribution, and every event is built to be approachable." },
    { q: "How do I join, and where are events announced?", a: "Fill in the Join form on this page and hop into our WhatsApp community — that's where we share dates, workshops and RSVP links. Follow us on Instagram and LinkedIn too." },
    { q: "Who runs this?", a: "The GitHub Community Club at GITAM University Bengaluru — students organising for students." },
  ],
};

/** Short commit-style hash for an event. Used by the timeline and by the terminal's `git log`, so they match. */
export const commitHash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(7, "0").slice(0, 7); };
