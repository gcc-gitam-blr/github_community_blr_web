import type { Metadata } from "next";
import { Player } from "@/components/quiz/Player";

export const metadata: Metadata = { title: "Quiz", description: "Join the live quiz and answer from your phone." };

export default function QuizPage() {
  return <Player />;
}
