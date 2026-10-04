import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Kiosk } from "@/components/epoch/Kiosk";
import { BOOTHS } from "@/lib/epoch/config";

/* A booth's QR, full screen, for a phone or tablet propped up at the booth. One page per coin booth. */
const COIN = BOOTHS.filter((b) => b.kind !== "free");
export const dynamicParams = false;
export const generateStaticParams = () => COIN.map((b) => ({ booth: b.id }));

export async function generateMetadata({ params }: { params: Promise<{ booth: string }> }): Promise<Metadata> {
  const { booth } = await params; const b = COIN.find((x) => x.id === booth);
  return b ? { title: `${b.name} · kiosk`, robots: { index: false } } : {};
}

export default async function Page({ params }: { params: Promise<{ booth: string }> }) {
  const { booth } = await params; const b = COIN.find((x) => x.id === booth);
  if (!b) notFound();
  return <Kiosk booth={b} />;
}
