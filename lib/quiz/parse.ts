/* Turns questions written by hand (or copied out of a PDF) into a quiz.

   The house format is a GitHub task list — the ticked box is the right answer:

     # Git basics
     ## What does `git clone` do?
     - [ ] Makes a new branch
     - [x] Copies a repository to your machine
     time: 20

   It also reads the formats people usually paste: numbered questions ("1. …", "Q1: …"),
   lettered options ("A) …", "(b) …", "c. …") or plain bullets, and the answer as
   "Answer: B", "Ans: c", "Correct: <option text>", or an option ending in * or (correct). */

export type QuizQuestion = { q: string; options: string[]; answer: number; time: number };
export type Quiz = { title: string; questions: QuizQuestion[] };
export type Problem = { line: number; message: string };

export const MIN_TIME = 5, MAX_TIME = 120, DEFAULT_TIME = 20, MAX_OPTIONS = 4;

const TITLE = /^#\s+(.+)$/;
const QUESTION = /^(?:##+\s*|(?:q(?:uestion)?\s*)?\d+\s*[.):\-]\s+|q(?:uestion)?\s*[.:\-]\s*)(.+)$/i;
const TASK = /^[-*+]\s*\[( |x|X)\]\s*(.+)$/;
const LETTERED = /^\(?([a-f])\s*[).:\]]\s+(.+)$/i;
const BULLET = /^[-*+•]\s+(.+)$/;
const ANSWER = /^(?:correct\s+answer|answer|ans|correct|key)\s*[:=\-]\s*(.+)$/i;
const TIME = /^(?:time|timer|seconds)\s*[:=\-]\s*(\d+)\s*s?(?:ec(?:ond)?s?)?$/i;
const MARKED = /\s*(?:\*|✓|✔|\((?:correct|answer|right)\))\s*$/i;

type Draft = { q: string; line: number; options: string[]; answer: number; answerText?: string; time: number };

export function parseQuiz(text: string): Quiz & { problems: Problem[] } {
  const problems: Problem[] = [];
  const questions: QuizQuestion[] = [];
  let title = "";
  let cur: Draft | null = null;

  const close = () => {
    if (!cur) return;
    const d = cur; cur = null;
    if (d.answerText !== undefined && d.answer < 0) d.answer = pickAnswer(d.answerText, d.options);
    if (d.options.length < 2) return void problems.push({ line: d.line, message: `"${short(d.q)}" needs at least 2 options` });
    if (d.options.length > MAX_OPTIONS) return void problems.push({ line: d.line, message: `"${short(d.q)}" has ${d.options.length} options — ${MAX_OPTIONS} at most` });
    if (d.answer < 0 || d.answer >= d.options.length) return void problems.push({ line: d.line, message: `"${short(d.q)}" has no correct answer — tick it with [x] or add "Answer: B"` });
    questions.push({ q: d.q, options: d.options, answer: d.answer, time: d.time });
  };

  text.replace(/\r\n?/g, "\n").split("\n").forEach((raw, i) => {
    const line = raw.trim(), n = i + 1;
    if (!line) return;
    let m: RegExpMatchArray | null;

    if (!questions.length && !cur && !title && (m = line.match(TITLE))) { title = clean(m[1]); return; }
    if (cur && (m = line.match(ANSWER))) { cur.answerText = m[1].trim(); return; }
    if (cur && (m = line.match(TIME))) { cur.time = Math.min(MAX_TIME, Math.max(MIN_TIME, Number(m[1]))); return; }

    // an option: a task-list box, a letter, or a bullet (only once a question is open)
    if (cur && (m = line.match(TASK))) { addOption(cur, m[2], m[1].toLowerCase() === "x"); return; }
    // "A) …" counts only when it's the next letter, so a question starting "A. …" isn't swallowed
    if (cur && (m = line.match(LETTERED)) && m[1].toLowerCase().charCodeAt(0) - 97 === cur.options.length) { addOption(cur, m[2], false); return; }
    if (cur && (m = line.match(BULLET))) { addOption(cur, m[1], false); return; }

    if ((m = line.match(QUESTION)) || !cur || cur.options.length) {
      close();
      cur = { q: clean(m ? m[1] : line), line: n, options: [], answer: -1, time: DEFAULT_TIME };
      return;
    }
    cur.q += " " + clean(line); // a question that wraps onto the next line
  });
  close();

  if (!questions.length && !problems.length) problems.push({ line: 1, message: "No questions found" });
  return { title: title || "Untitled quiz", questions, problems };
}

function addOption(d: Draft, raw: string, ticked: boolean) {
  const marked = MARKED.test(raw);
  const text = clean(raw.replace(MARKED, ""));
  if ((ticked || marked) && d.answer < 0) d.answer = d.options.length;
  d.options.push(text);
}

/** "B", "b)", "2", or the option's own text. */
function pickAnswer(a: string, options: string[]) {
  const s = a.replace(/[().\]]/g, "").trim();
  if (/^[a-f]$/i.test(s)) return s.toLowerCase().charCodeAt(0) - 97;
  if (/^\d+$/.test(s)) return Number(s) - 1;
  const lead = s.match(/^([a-f])\s+\S/i); // "B Copies a repository…"
  const exact = options.findIndex((o) => norm(o) === norm(s));
  if (exact >= 0) return exact;
  if (lead) return lead[1].toLowerCase().charCodeAt(0) - 97;
  return options.findIndex((o) => norm(o).includes(norm(s)) || norm(s).includes(norm(o)));
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const norm = (s: string) => s.toLowerCase().replace(/[`'"*_]/g, "").replace(/\s+/g, " ").trim();
const short = (s: string) => (s.length > 40 ? s.slice(0, 38) + "…" : s);

/** Writes a quiz back out in the house format (for saving a pasted quiz into content/quizzes). */
export function toMarkdown(quiz: Quiz) {
  return [`# ${quiz.title}`, ...quiz.questions.map((q) => [
    "", `## ${q.q}`, ...q.options.map((o, i) => `- [${i === q.answer ? "x" : " "}] ${o}`), ...(q.time !== DEFAULT_TIME ? [`time: ${q.time}`] : []),
  ].join("\n"))].join("\n") + "\n";
}
