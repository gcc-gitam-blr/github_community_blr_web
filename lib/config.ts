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
  githubOrg: "", // e.g. "github-community-blr" — enables live repos
  githubUrl: "https://github.com",
  email: "hello@example.com",
  socials: [
    { label: "GitHub", href: "https://github.com" },
    { label: "Discord", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "LinkedIn", href: "#" },
  ],
  stats: [
    { value: 6, suffix: "", label: "Events in 2026-27" },
    { value: 21, suffix: "", label: "Booths at Epoch" },
    { value: 2, suffix: "", label: "Days of Epoch" },
    { value: 398, suffix: "", label: "Coins per ₹199 ticket" },
  ],
  tracks: [
    { id: "oss", shape: "diamond", color: "blue", title: "Open Source", text: "Fork it, fix it, ship your first pull request to a real project — with mentors reviewing every step." },
    { id: "web", shape: "square", color: "purple", title: "Web & Apps", text: "From HTML to full-stack products. Build things people actually open on their phones." },
    { id: "ai", shape: "ring", color: "mint", title: "AI & Data", text: "Copilots, models, notebooks and agents. Learn to build with the tools reshaping the industry." },
    { id: "cloud", shape: "triangle", color: "blue", title: "Cloud & DevOps", text: "Actions, containers, pipelines. Automate everything, deploy on a Friday, sleep fine." },
    { id: "sec", shape: "diamond", color: "purple", title: "Security", text: "Dependabot, secret scanning, CTFs. Think like an attacker, code like a defender." },
    { id: "design", shape: "square", color: "mint", title: "Design & Docs", text: "Great READMEs, sharp UI, clear writing. The unglamorous skills that make projects win." },
  ] as { id: string; shape: Shape; color: NodeColor; title: string; text: string }[],
  events: [
    { date: "2026-10-05", type: "Workshop", title: "Learn GitHub & Make Your First Contribution", text: "Introduction to GitHub, repositories, commits, issues, pull requests — and your first contribution.", where: "GITAM Bengaluru", shape: "diamond", color: "blue" },
    { date: "2026-10-12", type: "Open Source", title: "GIT Merge 26", text: "A GitHub and open-source event: learn Git, explore open source, make beginner-friendly contributions.", where: "GITAM Bengaluru", shape: "square", color: "purple" },
    { date: "2026-12-01", dateLabel: "December 2026", type: "Flagship", title: "EPOCH — GitHub Technical Month", text: "The club's major technical event: challenges, project development, presentations, a project showcase — and the Epoch Coins economy.", where: "GITAM Bengaluru", shape: "triangle", color: "mint", href: "/epoch" },
    { date: "2027-01-04", type: "Workshop", title: "Build & Deploy with GitHub", text: "Build a website, app or student project and publish it using GitHub and related tools.", where: "GITAM Bengaluru", shape: "ring", color: "blue" },
    { date: "2027-02-08", type: "Workshop", title: "GitHub Profile Makeover", text: "Level up your profile, READMEs, repositories and project presentation for academic and professional use.", where: "GITAM Bengaluru", shape: "diamond", color: "purple" },
    { date: "2027-03-15", type: "Career", title: "GitHub for Careers & Technical Challenge", text: "How GitHub helps with internships, placements and portfolios — followed by a technical challenge.", where: "GITAM Bengaluru", shape: "square", color: "mint" },
  ] as { date: string; dateLabel?: string; href?: string; type: string; title: string; text: string; where: string; shape: Shape; color: NodeColor }[],
  sampleRepos: [
    { name: "club-website", description: "This very site. Next.js, open for contributions.", language: "TypeScript", stars: 0, url: "#" },
    { name: "first-contributions", description: "A friendly playground for your first ever pull request.", language: "Markdown", stars: 0, url: "#" },
    { name: "epoch-app", description: "Coins, QR scans and leaderboards for our fest.", language: "TypeScript", stars: 0, url: "#" },
  ],
  team: [
    { role: "Club Lead", handle: "", note: "Vision, partnerships, keeps the lights on." },
    { role: "Tech Lead", handle: "", note: "Reviews PRs, owns the infrastructure." },
    { role: "Community Lead", handle: "", note: "Welcomes every newcomer, runs the events." },
    { role: "Design Lead", handle: "", note: "Makes everything we ship look sharp." },
  ],
  faq: [
    { q: "What is Epoch?", a: "Our flagship technical event in December: two days of workshops, coding competitions and 20+ interactive booths — run on its own currency, Epoch Coins." },
    { q: "How do Epoch Coins work?", a: "Your ticket converts to coins at 1 ₹ = 2 coins (₹199 → 398 coins, final price to be announced). Spend them at booths and on merch, and top up at recharge points." },
    { q: "Can I earn more coins?", a: "Yes. Recharge points run mini-games — trivia, quick coding puzzles — worth around 20 coins. Each recharge point works once per person." },
    { q: "Do I need to know how to code?", a: "No. The year starts with a beginner session, Learn GitHub & Make Your First Contribution, and every event is built to be approachable." },
    { q: "Who runs this?", a: "The GitHub Community Club at GITAM University Bengaluru — students organising for students." },
  ],
};
