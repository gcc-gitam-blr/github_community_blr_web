import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Host } from "@/components/quiz/Host";

export const metadata: Metadata = { title: "Host a quiz" };

// every content/quizzes/*.md is a quiz ready to host (the format is in lib/quiz/parse.ts)
const DIR = path.join(process.cwd(), "content", "quizzes");
const quizzes = () => fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort()
  .map((f) => ({ slug: f.replace(/\.md$/, ""), text: fs.readFileSync(path.join(DIR, f), "utf8") }));

export default function HostPage() {
  return <Host quizzes={quizzes()} />;
}
