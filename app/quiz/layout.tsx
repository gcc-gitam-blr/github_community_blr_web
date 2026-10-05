import type { Metadata, Viewport } from "next";

// the quiz is a dark stage on the projector and on phones; the browser bar matches it
export const viewport: Viewport = { themeColor: "#0b0b0f", viewportFit: "cover" };
export const metadata: Metadata = { title: "Quiz", description: "Join the live quiz with the code on the big screen.", robots: { index: false, follow: false } };

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#0b0b0f]">{children}</div>;
}
