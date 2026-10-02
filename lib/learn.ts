/* Content for /learn: a Git cheat sheet and trusted, free resources. Every link is a real, long-lived page. */
export interface Cmd { cmd: string; what: string }
export const CHEAT: { group: string; blurb: string; cmds: Cmd[] }[] = [
  { group: "Start", blurb: "Set yourself up, begin a project.", cmds: [
    { cmd: 'git config --global user.name "Your Name"', what: "Tell Git who you are (once per computer)" },
    { cmd: 'git config --global user.email "you@example.com"', what: "Use the same email as your GitHub account" },
    { cmd: "git init", what: "Turn the current folder into a Git repository" },
    { cmd: "git clone <url>", what: "Download a repository from GitHub" },
  ] },
  { group: "Save", blurb: "Record your work as commits.", cmds: [
    { cmd: "git status", what: "See what changed and what's staged" },
    { cmd: "git add <file>", what: "Stage a file for the next commit" },
    { cmd: "git add .", what: "Stage everything that changed" },
    { cmd: 'git commit -m "message"', what: "Save the staged changes with a message" },
    { cmd: "git log --oneline", what: "Show the history, one line per commit" },
    { cmd: "git diff", what: "See exactly what you changed" },
  ] },
  { group: "Branch", blurb: "Try ideas without breaking what works.", cmds: [
    { cmd: "git branch", what: "List your branches" },
    { cmd: "git switch -c <name>", what: "Create a branch and move onto it" },
    { cmd: "git switch <name>", what: "Move to another branch" },
    { cmd: "git merge <name>", what: "Bring another branch's work into this one" },
    { cmd: "git branch -d <name>", what: "Delete a branch you've finished with" },
  ] },
  { group: "Share", blurb: "Send your work to GitHub, get others' work.", cmds: [
    { cmd: "git remote -v", what: "Show where your repository is online" },
    { cmd: "git push origin <branch>", what: "Upload your commits" },
    { cmd: "git pull", what: "Download and merge the latest changes" },
    { cmd: "git fetch", what: "Download changes without merging them yet" },
  ] },
  { group: "Undo", blurb: "Everyone makes mistakes — Git can undo most.", cmds: [
    { cmd: "git restore <file>", what: "Throw away changes to a file (not staged)" },
    { cmd: "git restore --staged <file>", what: "Unstage a file, keep your changes" },
    { cmd: "git commit --amend", what: "Fix the last commit's message or contents" },
    { cmd: "git revert <commit>", what: "Undo a commit by adding a new one (safe for shared work)" },
    { cmd: "git stash", what: "Park unfinished work, get a clean folder" },
    { cmd: "git stash pop", what: "Bring the parked work back" },
  ] },
  { group: "Collaborate", blurb: "Working with other people's projects.", cmds: [
    { cmd: "git remote add upstream <url>", what: "Link the original project you forked" },
    { cmd: "git fetch upstream", what: "Get the original project's latest changes" },
    { cmd: "git rebase upstream/main", what: "Replay your work on top of the latest original" },
    { cmd: "gh pr create", what: "Open a pull request (GitHub CLI)" },
    { cmd: "gh pr checkout <number>", what: "Try out someone else's pull request" },
  ] },
];

export interface Resource { title: string; by: string; url: string; blurb: string; level: "Start here" | "Next" | "Go further" }
export const RESOURCES: Resource[] = [
  { title: "GitHub Skills", by: "GitHub", url: "https://skills.github.com", blurb: "Short interactive courses that run inside a real repository — the best first stop.", level: "Start here" },
  { title: "First Contributions", by: "Open source", url: "https://github.com/firstcontributions/first-contributions", blurb: "Make your very first pull request, step by step, on a project built for practice.", level: "Start here" },
  { title: "Learn Git Branching", by: "Peter Cottle", url: "https://learngitbranching.js.org", blurb: "A visual, game-like way to understand branches, merges and rebases.", level: "Start here" },
  { title: "GitHub Docs", by: "GitHub", url: "https://docs.github.com", blurb: "The official reference. Search it whenever you're stuck.", level: "Next" },
  { title: "Pro Git (free book)", by: "Scott Chacon & Ben Straub", url: "https://git-scm.com/book", blurb: "The standard Git book — free online. Chapters 1–3 cover almost everything you'll need.", level: "Next" },
  { title: "GitHub Student Developer Pack", by: "GitHub Education", url: "https://education.github.com/pack", blurb: "Free tools for students — Copilot, hosting, domains and more. Verify with your college email.", level: "Next" },
  { title: "Good First Issue", by: "Community", url: "https://goodfirstissue.dev", blurb: "Find beginner-friendly issues in real open-source projects.", level: "Go further" },
  { title: "Open Source Guides", by: "GitHub", url: "https://opensource.guide", blurb: "How to contribute, how projects work, and how to be a good community member.", level: "Go further" },
];
