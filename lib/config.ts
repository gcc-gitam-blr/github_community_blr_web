/* ============================================================
   EDIT ME — everything the public site shows lives here.
   Epoch (the fest) has its own config in lib/epoch/config.ts.
   ============================================================ */

export type Shape = "diamond" | "square" | "ring" | "triangle";
export type NodeColor = "blue" | "purple" | "mint" | "green";

export const CLUB = {
  name: "GitHub Community Club BLR",
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
    { value: 250, suffix: "+", label: "Members" },
    { value: 40, suffix: "+", label: "Repos shipped" },
    { value: 25, suffix: "", label: "Events hosted" },
    { value: 1200, suffix: "+", label: "Commits pushed" },
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
    { date: "2026-10-18", type: "Workshop", title: "Git & GitHub from zero", text: "Branches, commits, pull requests. Leave with your first merged PR.", where: "Campus · Lab 3", shape: "diamond", color: "blue" },
    { date: "2026-11-08", type: "Hackathon", title: "24h Build Sprint", text: "Teams of four, one idea, one repo. Demo to a panel of engineers.", where: "Main auditorium", shape: "triangle", color: "mint" },
    { date: "2026-11-29", type: "Talk", title: "Contributing to open source", text: "Maintainers share how to pick issues, communicate, and get merged.", where: "Online · Discord", shape: "ring", color: "purple" },
    { date: "2026-12-13", type: "Open Source", title: "Merge Day", text: "A full day of pair-programming on real issues across the ecosystem.", where: "Campus · Lab 1", shape: "square", color: "blue" },
  ] as { date: string; type: string; title: string; text: string; where: string; shape: Shape; color: NodeColor }[],
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
    { q: "Do I need to know how to code?", a: "No. We run beginner tracks from absolute zero. If you can use a browser, you can start." },
    { q: "Is it free?", a: "Yes — membership is free. We may charge for special hackathon merch, never for learning." },
    { q: "Who can join?", a: "Any student of the university. Other branches and alumni are welcome at open events." },
    { q: "Do I need a GitHub account?", a: "You'll create one at your first workshop if you don't have it. Takes two minutes." },
    { q: "What is Epoch?", a: "Our annual tech fest. You get Epoch Coins on sign-up, earn more at events and stalls, and spend them on rewards." },
  ],
};
