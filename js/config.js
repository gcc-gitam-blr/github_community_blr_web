/* ============================================================
   EDIT ME — everything the site shows lives here.
   Swap the placeholders below for real club details.
   ============================================================ */
window.GC = window.GC || {};

window.GC.CONFIG = {
  name: "GitHub Community Club BLR",

  // Your GitHub organisation (without the URL). Leave "" to use sample repos.
  githubOrg: "",
  githubUrl: "https://github.com",

  // Join form: paste a Formspree / Getform endpoint to receive sign-ups.
  // Leave "" and the form falls back to opening an email to `email`.
  formEndpoint: "",
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
  ],

  // Sample events — replace with your real ones (newest first is fine, sorted below).
  events: [
    { date: "2026-10-18", type: "Workshop", title: "Git & GitHub from zero", text: "Branches, commits, pull requests. Leave with your first merged PR.", where: "Campus · Lab 3", shape: "diamond", color: "blue" },
    { date: "2026-11-08", type: "Hackathon", title: "24h Build Sprint", text: "Teams of four, one idea, one repo. Demo to a panel of engineers.", where: "Main auditorium", shape: "triangle", color: "mint" },
    { date: "2026-11-29", type: "Talk", title: "Contributing to open source", text: "Maintainers share how to pick issues, communicate, and get merged.", where: "Online · Discord", shape: "ring", color: "purple" },
    { date: "2026-12-13", type: "Open Source", title: "Hacktoberfest-style Merge Day", text: "A full day of pair-programming on real issues across the ecosystem.", where: "Campus · Lab 1", shape: "square", color: "blue" },
  ],

  // Fallback cards shown when githubOrg is empty or the API is unreachable.
  sampleRepos: [
    { name: "club-website", description: "This very site. Static, fast, and open for contributions.", language: "HTML", stargazers_count: 0, html_url: "#" },
    { name: "first-contributions", description: "A friendly playground for your first ever pull request.", language: "Markdown", stargazers_count: 0, html_url: "#" },
    { name: "event-bot", description: "Discord bot that announces meetups and tracks RSVPs.", language: "JavaScript", stargazers_count: 0, html_url: "#" },
  ],

  // Core team — add `handle` (GitHub username) to show a real avatar.
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
    { q: "How do I get involved beyond attending?", a: "Contribute to our repos, volunteer at events, or apply for a core-team role each semester." },
  ],
};
