import type { Metadata, Viewport } from "next";
import { ExamTimer } from "@/components/timer/ExamTimer";

// a dark stage on the projector; the browser bar matches it
export const viewport: Viewport = { themeColor: "#0b0b0f", viewportFit: "cover" };
export const metadata: Metadata = { title: "Exam timer", description: "A countdown for pen-and-paper tests, made for the projector.", robots: { index: false, follow: false } };

export default function TimerPage() {
  return <div className="bg-[#0b0b0f]"><ExamTimer /></div>;
}
