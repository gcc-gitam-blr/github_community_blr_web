import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PhotoUploader } from "@/components/site/PhotoUploader";

export const metadata: Metadata = { title: "Add photos", robots: { index: false, follow: false } };

export default function PhotosPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1040px] px-5 pb-24 pt-[130px] md:px-10">
        <p className="font-mono text-[13px] text-ink-2">{"// git add photos/"}</p>
        <h1 className="mt-4 text-[clamp(40px,6.4vw,76px)]">Add photos.</h1>
        <p className="mt-4 max-w-[58ch] text-[18px] text-ink-2">For organisers: pick the event, choose photos, add a caption if you like. They&apos;re made small and stripped of location data on your device, then added to the site.</p>
        <PhotoUploader />
      </main>
      <SiteFooter />
    </>
  );
}
