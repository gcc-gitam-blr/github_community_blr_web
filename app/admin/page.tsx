import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { EpochProvider } from "@/components/epoch/EpochProvider";
import { AdminApp } from "@/components/admin/AdminApp";
import { parseQuiz } from "@/lib/quiz/parse";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// the quizzes in content/quizzes, listed under Timer & quiz (just the title and size: the host page reads them in full)
const DIR = path.join(process.cwd(), "content", "quizzes");
const quizzes = () => fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort().map((f) => {
  const q = parseQuiz(fs.readFileSync(path.join(DIR, f), "utf8"));
  return { slug: f.replace(/\.md$/, ""), title: q.title, questions: q.questions.length };
});

/* The club's admin dashboard: sign-ups, messages, feedback, attendance & certificates, the room tools and who has access. */
export default function AdminPage() {
  return <EpochProvider><AdminApp quizzes={quizzes()} /></EpochProvider>;
}
