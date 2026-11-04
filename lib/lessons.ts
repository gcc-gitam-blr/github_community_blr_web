/* "Git in 60 seconds": the lessons the weekly newsletter teaches, one per issue. Each is a puzzle (spot what's wrong),
   then the problem, the fix, one habit to keep and a one-tap question. Written to be read in about a minute by someone
   who has never used Git. Plain text only: the email template does the layout. Add a lesson at the end of the list;
   the order is the order they go out. */
export type Line = [dim: string, text: string]; // one terminal line: a faint left part (a hash, a marker) and the text

export interface Lesson {
  slug: string;
  subject: string; // the puzzle, as the subject line
  preheader: string; // the grey line after the subject in the inbox
  setup: string; // the line above the first terminal
  question: string;
  hint: string;
  before: { cmd: string; lines: Line[] };
  problem: { title: string; text: string };
  steps: { title: string; note: string }[];
  after: { cmd: string; lines: Line[] };
  habit: { title: string; text: string };
  summary: string;
  poll: { question: string; yes: string; no: string };
}

const log = "git log --oneline";

export const LESSONS: Lesson[] = [
  {
    slug: "commit-messages",
    subject: "Spot the problem in these commit messages",
    preheader: "Thirty seconds. No cheating.",
    setup: "Here's a real commit history, the kind most of us write when we're in a hurry:",
    question: "What's wrong with this?",
    hint: "Imagine you have to find one bug in this project six months from now.",
    before: { cmd: log, lines: [["a1f9c3e", "wip"], ["7d02be1", "asdf"], ["3c8e1aa", "fix"], ["91b4d70", "final"], ["e5a6620", "final final"]] },
    problem: {
      title: "Nobody can tell what changed.",
      text: "\"fix\" fixes what? \"final\" is final until the next one. When something breaks, you have to open every commit to find the one that did it.",
    },
    steps: [
      { title: "Start with a verb", note: "Add, Fix, Remove, Rename. It says what the commit does." },
      { title: "Keep the first line short", note: "About 50 characters. If you need more, leave a blank line and explain underneath." },
      { title: "One idea per commit", note: "If the message needs the word \"and\", it's two commits." },
    ],
    after: { cmd: log, lines: [["b3d7a10", "Add dark mode switch to settings"], ["4e91c2f", "Fix login button overlapping on phones"], ["c88a0d5", "Stop footer jumping when images load"], ["1fa6e73", "Rename Event to Workshop in schedule"], ["9d20b4c", "Add setup steps to the README"]] },
    habit: { title: "Write for the person who reads it later", text: "That person is usually you, tired, hunting for the commit that broke the build." },
    summary: "A good commit message answers one question: what changed? Add why when it isn't obvious.",
    poll: { question: "Be honest: have your commit messages ever looked like the first list?", yes: "Yes, guilty", no: "Never" },
  },
  {
    slug: "gitignore",
    subject: "Spot the problem before this commit goes out",
    preheader: "Two of these files should never be committed.",
    setup: "Someone is about to make their first commit on a new project. This is what Git is about to save:",
    question: "Which of these should never go into the repository?",
    hint: "One of them holds a password. One of them is 4,812 files you can download again any time.",
    before: { cmd: "git status", lines: [["new file:", ".env"], ["new file:", "node_modules/ (4,812 files)"], ["new file:", "src/app.js"], ["new file:", "README.md"]] },
    problem: {
      title: "A secret and a download, saved forever.",
      text: ".env holds your API keys. Once pushed, anyone who can see the repo can use them, and deleting the file later doesn't remove it from history. node_modules is just packages npm can install again.",
    },
    steps: [
      { title: "Make a .gitignore first", note: "A text file in the project's top folder. Each line is a file or folder Git should leave alone." },
      { title: "List .env and node_modules/", note: "GitHub has ready-made ones for every language: pick one when you create the repo." },
      { title: "Already pushed a key? Change it", note: "Treat it as leaked: make a new key and switch the old one off. Removing the file isn't enough." },
    ],
    after: { cmd: "cat .gitignore", lines: [["1", ".env"], ["2", "node_modules/"], ["3", "dist/"], ["4", ".DS_Store"]] },
    habit: { title: "Read git status before every commit", text: "Five seconds of reading catches the file you didn't mean to share." },
    summary: "Commit what you wrote. Ignore what's secret or can be downloaded again.",
    poll: { question: "Have you ever pushed a password or key by mistake?", yes: "Yes, once", no: "Not yet" },
  },
  {
    slug: "branches",
    subject: "Three people, one main branch. Spot the problem.",
    preheader: "The site broke and nobody knows why.",
    setup: "Three friends are building the club app together. This is main after one afternoon:",
    question: "Why did the app stop working for everyone?",
    hint: "Look at the second commit. Was it finished?",
    before: { cmd: log, lines: [["f2a91c0", "Fix typo on home page"], ["8be3d47", "Half done login page, don't use yet"], ["c41e9a2", "Add events list"], ["07dd1b5", "Try new colours"]] },
    problem: {
      title: "Unfinished work went straight to main.",
      text: "Main is the version everyone uses. A half-done login page there breaks the app for all three of them, and the colour experiment is mixed in with real work.",
    },
    steps: [
      { title: "Make a branch for each piece of work", note: "git switch -c add-login-page. Now your commits stay on your branch." },
      { title: "Finish it there", note: "Commit as often as you like. Main doesn't change until you're done." },
      { title: "Merge it back with a pull request", note: "A teammate looks it over, then it joins main in one piece." },
    ],
    after: { cmd: "git branch", lines: [["", "main"], ["*", "add-login-page"], ["", "events-list"], ["", "try-new-colours"]] },
    habit: { title: "Main should always work", text: "If you wouldn't show it to the whole club yet, it belongs on a branch." },
    summary: "A branch is a safe copy to work on. Main is what everyone sees.",
    poll: { question: "Do you make a branch before you start something new?", yes: "Always", no: "I just use main" },
  },
  {
    slug: "small-commits",
    subject: "48 files in one commit. What's the problem?",
    preheader: "Your reviewer is not going to enjoy this.",
    setup: "Someone finished a big feature and committed everything at once:",
    question: "Why will this be hard to review, and even harder to undo?",
    hint: "Say one line in it breaks the login. How do you take back just that line?",
    before: { cmd: "git show --stat", lines: [["", "Add new features and fix stuff"], ["", "48 files changed, 3,912 insertions(+), 1,207 deletions(-)"]] },
    problem: {
      title: "Too much in one place.",
      text: "Nobody can review 4,000 lines properly, so mistakes slip through. And if one part is wrong, undoing the commit undoes all of it.",
    },
    steps: [
      { title: "Commit each step as you finish it", note: "Got the form working? Commit. Added the styles? Commit." },
      { title: "Pick what goes in with git add -p", note: "It shows each change and asks yes or no, so one commit holds one idea." },
      { title: "Aim for a commit you can explain in one line", note: "If the message needs \"and\", split it." },
    ],
    after: { cmd: log, lines: [["e61c0b2", "Add sign-up form"], ["9a47d13", "Check the email address on sign-up"], ["2fd8e90", "Style the sign-up form for phones"], ["b0c35a1", "Fix login redirect after sign-up"]] },
    habit: { title: "Small and often", text: "Ten small commits are easier to review, explain and undo than one big one." },
    summary: "One commit, one idea. Your reviewer, and future you, will thank you.",
    poll: { question: "What's the most files you've put in one commit?", yes: "Over 20", no: "Under 20" },
  },
  {
    slug: "force-push",
    subject: "Your teammate's work just vanished. Spot why.",
    preheader: "One command, two hours of someone else's work gone.",
    setup: "Git refused a push, so someone tried again with a stronger command:",
    question: "What happened to the commits their teammate pushed this morning?",
    hint: "Git refused the first push for a reason.",
    before: { cmd: "git push", lines: [["!", "[rejected] main -> main (fetch first)"], ["$", "git push --force"], ["+", "a91c3e0...4d2b7f1 main -> main (forced update)"]] },
    problem: {
      title: "--force replaced the shared history with yours.",
      text: "The push was rejected because main had new commits you didn't have. Forcing it threw those commits away for everyone.",
    },
    steps: [
      { title: "Get their work first", note: "git pull. Git combines their commits with yours." },
      { title: "Fix any conflicts, then push", note: "Now the push goes through normally, and nothing is lost." },
      { title: "If you really must force, use the safe one", note: "git push --force-with-lease refuses if someone else has pushed since you last looked." },
    ],
    after: { cmd: "git pull && git push", lines: [["", "Merge made by the 'ort' strategy."], ["", "a91c3e0..7e0d2c4  main -> main"]] },
    habit: { title: "Rejected means \"pull first\"", text: "Read the message Git gives you. It almost always says what to do." },
    summary: "Never force-push a branch other people use. Pull, then push.",
    poll: { question: "Have you ever used git push --force?", yes: "Yes", no: "Never" },
  },
  {
    slug: "pull-requests",
    subject: "Would you approve this pull request?",
    preheader: "Title: update. Description: empty.",
    setup: "A pull request lands in your club repo. This is all it says:",
    question: "What does the reviewer have to do before they can even start?",
    hint: "What changed, why, and how would you check it works?",
    before: { cmd: "Pull request #42", lines: [["Title", "update"], ["Description", "(empty)"], ["Files", "23 changed"]] },
    problem: {
      title: "The reviewer has to guess.",
      text: "They have to read all 23 files to work out what you meant to do, then guess how to test it. Most people put it off, so it waits for days.",
    },
    steps: [
      { title: "Say what it does in the title", note: "\"Add dark mode switch to settings\", like a good commit message." },
      { title: "Say why, and how to check it", note: "Two or three lines: the problem, and the steps to see it working." },
      { title: "Link the issue", note: "Write \"Closes #12\" and GitHub closes the issue when it's merged." },
    ],
    after: { cmd: "Pull request #42", lines: [["Title", "Add dark mode switch to settings"], ["Why", "People asked for it in #12; the site is hard to read at night"], ["Check", "Settings > Appearance > Dark. Reload: it stays dark"], ["Closes", "#12"]] },
    habit: { title: "Make reviewing easy", text: "The easier you make it to say yes, the sooner your work is merged." },
    summary: "A pull request is a note to a busy person: what, why, and how to check.",
    poll: { question: "Have you ever opened a pull request?", yes: "Yes", no: "Not yet" },
  },
  {
    slug: "merge-conflicts",
    subject: "This page shows strange arrows. Spot why.",
    preheader: "<<<<<<< HEAD is not a design choice.",
    setup: "After a merge, the club's home page suddenly shows this at the top:",
    question: "What went wrong, and which heading is right?",
    hint: "Two people changed the same line on two branches.",
    before: { cmd: "cat index.html", lines: [["", "<<<<<<< HEAD"], ["", "<h1>Welcome to the club</h1>"], ["", "======="], ["", "<h1>Hello, builders</h1>"], ["", ">>>>>>> new-homepage"]] },
    problem: {
      title: "A merge conflict was committed as it was.",
      text: "Git couldn't choose between the two headings, so it marked both and asked a person to decide. Nobody did, and the markers went live.",
    },
    steps: [
      { title: "Find the markers", note: "git status lists the files in conflict. Search them for <<<<<<<." },
      { title: "Keep what's right, delete the rest", note: "Pick one version or combine them, and remove every marker line." },
      { title: "Check it works, then commit", note: "Open the page. Then git add and git commit to finish the merge." },
    ],
    after: { cmd: "cat index.html", lines: [["", "<h1>Welcome to the club, builders</h1>"]] },
    habit: { title: "A conflict is a question, not an error", text: "Git is asking which version you want. Answer it, then look before you commit." },
    summary: "Conflicts are normal. Committing the markers isn't.",
    poll: { question: "Has a merge conflict ever scared you?", yes: "Yes", no: "No, I've got this" },
  },
  {
    slug: "good-issues",
    subject: "\"It doesn't work, pls help.\" Spot the problem.",
    preheader: "How to ask so people can actually help you.",
    setup: "Someone opens an issue on an open-source project:",
    question: "What would the maintainer need to know before they can help?",
    hint: "They can't see your screen.",
    before: { cmd: "Issue #87", lines: [["Title", "doesnt work"], ["Body", "i tried everything pls help urgent"]] },
    problem: {
      title: "Nobody can help with this.",
      text: "\"Doesn't work\" could mean a hundred things. The maintainer has to ask five questions first, and many just close it.",
    },
    steps: [
      { title: "Say what you did", note: "The exact steps or command, in order." },
      { title: "Say what you expected and what happened", note: "Paste the full error message as text, not a photo of your screen." },
      { title: "Say what you're using", note: "Your operating system and the version of the tool." },
    ],
    after: { cmd: "Issue #87", lines: [["Title", "npm start fails with 'port 3000 in use' on Windows"], ["Did", "Cloned the repo, ran npm install, then npm start"], ["Expected", "The site opens at localhost:3000"], ["Got", "Error: listen EADDRINUSE :::3000"], ["Using", "Windows 11, Node 20.11"]] },
    habit: { title: "Search before you ask", text: "Paste the error into the issue search first. Someone may have solved it already." },
    summary: "A good issue lets a stranger help you without asking a single question.",
    poll: { question: "Have you ever opened an issue on someone else's project?", yes: "Yes", no: "Not yet" },
  },
];

/** This week's lesson: one a week, in order, the same all week (and round again once they run out). */
export function lessonOfTheWeek(today: string): Lesson {
  return LESSONS[weekNumber(today) % LESSONS.length];
}
const weekNumber = (today: string) => Math.floor(Date.parse(today + "T00:00:00Z") / (7 * 864e5));
export const lessonBySlug = (slug: string | undefined) => LESSONS.find((l) => l.slug === slug);
