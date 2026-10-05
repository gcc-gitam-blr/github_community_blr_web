/* The quiz importer: the house task-list format, and the formats people paste from PDFs and docs. */
import { parseQuiz, toMarkdown } from "../lib/quiz/parse";
import { HostGame } from "../lib/quiz/game";
import { points } from "../lib/quiz/room";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

const house = parseQuiz(`# Git basics

## What does \`git clone\` do?
- [ ] Makes a new branch
- [x] Copies a repository to your machine
- [ ] Deletes the remote
time: 30

## Which command stages a file?
- [x] git add
- [ ] git push`);
ok("reads the title", house.title === "Git basics");
ok("reads both questions", house.questions.length === 2 && !house.problems.length);
ok("the ticked box is the answer", house.questions[0].answer === 1 && house.questions[1].answer === 0);
ok("reads the time", house.questions[0].time === 30 && house.questions[1].time === 20);

const pasted = parseQuiz(`1. What does PR stand for
in GitHub?
A) Public Repo
B) Pull Request
C) Push Release
D) Private Rebase
Answer: B

Q2: Which branch is usually the default?
(a) main
(b) feature
Ans: a

3) Git was created by?
a. Linus Torvalds *
b. Bill Gates`);
ok("numbered questions with lettered options", pasted.questions.length === 3 && !pasted.problems.length);
ok("a question that wraps is joined", pasted.questions[0].q === "What does PR stand for in GitHub?");
ok("Answer: B", pasted.questions[0].answer === 1);
ok("Ans: a", pasted.questions[1].answer === 0);
ok("an option marked with *", pasted.questions[2].answer === 0 && pasted.questions[2].options[0] === "Linus Torvalds");

const byText = parseQuiz(`What is a commit?
- A snapshot of your changes
- A remote server
Correct: a snapshot of your changes`);
ok("the answer can be the option's text", byText.questions[0]?.answer === 0);

const bad = parseQuiz(`## No answer here?
- [ ] one
- [ ] two

## Too few
- [x] only one`);
ok("a question without an answer is reported", bad.problems.some((p) => p.line === 1 && /no correct answer/.test(p.message)));
ok("a question with one option is reported", bad.problems.some((p) => p.line === 5));
ok("nothing at all is reported", parseQuiz("").problems.length === 1);

const round = parseQuiz(toMarkdown(house));
ok("writing it back out reads the same", JSON.stringify(round.questions) === JSON.stringify(house.questions) && round.title === house.title);

/* the host's game: joining, answering, scoring */
const game = new HostGame({ code: "abc123", quiz: house, phase: "lobby", index: 0, players: [], kicked: [] }, null);
game.next();
ok("can't start with nobody in the room", game.get().phase === "lobby");
game.hear({ t: "hello", id: "a", name: "Mona" });
game.hear({ t: "hello", id: "b", name: "mona" });
game.hear({ t: "hello", id: "a", name: "Mona again" });
ok("the same name twice gets a number", game.get().players.map((p) => p.name).join() === "Mona,mona 2");
ok("saying hello twice doesn't join twice", game.get().players.length === 2);
game.next();
const asking = game.state();
ok("the question goes out without its answer", asking.phase === "question" && asking.answer === undefined && !("answer" in (asking.question ?? {})));
game.hear({ t: "answer", id: "a", index: 0, choice: 1 });
game.hear({ t: "answer", id: "a", index: 0, choice: 0 });
game.hear({ t: "answer", id: "zz", index: 0, choice: 1 });
ok("one answer each, strangers ignored", game.get().answered === 1);
game.hear({ t: "answer", id: "b", index: 0, choice: 2 });
game.reveal();
const shown = game.state();
ok("the reveal has the answer and the counts", shown.answer === 1 && shown.counts?.join() === "0,1,1");
ok("a quick right answer is worth close to 1000", shown.results.a[0] > 900 && shown.results.a[3] === 1 && shown.results.a[1] === 1);
ok("a wrong answer scores nothing", shown.results.b[0] === 0 && shown.results.b[3] === 0 && shown.results.b[1] === 2);
ok("points: 500 at the buzzer, streaks add 50", points(20_000, 20, 1) === 500 && points(0, 20, 3) === 1100);
game.kick("b");
game.hear({ t: "hello", id: "b", name: "back again" });
ok("a removed player can't rejoin", !game.state().results.b && game.get().players.length === 1);
game.next();
ok("after the last question comes the end", game.get().phase === "board" && (game.next(), game.get().phase === "question") && (game.reveal(), game.next(), game.get().phase === "end"));

if (fails) { console.log(`${fails} quiz check(s) failed`); process.exit(1); }
console.log("all quiz checks passed");
