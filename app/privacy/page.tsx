import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CLUB } from "@/lib/config";
import { RETENTION } from "@/lib/retention";

export const metadata: Metadata = { title: "Privacy", description: "What the GitHub Community Club collects, why, and how to have it removed." };
const UPDATED = "4 October 2026";

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 mt-12 text-[26px]">{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{children}</p>;
const L = ({ children }: { children: React.ReactNode }) => <ul className="mt-3 list-disc space-y-2 pl-6 text-[17px] leading-relaxed text-ink-2">{children}</ul>;

export default function Privacy() {
  const contact = CLUB.email ? <a className="text-link underline" href={`mailto:${CLUB.email}`}>{CLUB.email}</a> : <>our WhatsApp community or Instagram</>;
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-[130px]">
        <p className="font-mono text-[13px] text-ink-3">Last updated {UPDATED}</p>
        <h1 className="mt-3 text-[clamp(38px,6vw,64px)]">Privacy, in plain words.</h1>
        <P>This site is run by students of the GitHub Community Club at {CLUB.university}. We collect as little as we can, only to run club events, and we never sell it.</P>

        <H>What we collect, and why</H>
        <L>
          <li><b>When you join the club:</b> your GitHub username, email address, and which event you want to try first. We use it to welcome you, remind you about events, and plan sessions.</li>
          <li><b>When you ask to hear about Epoch dates:</b> only your email address. We use it to tell you when the dates are announced, and for Epoch news after that. Nothing else.</li>
          <li><b>When you use Epoch (our fest):</b> your name, GitHub username (via GitHub sign-in) and email, your Epoch Coins balance, and a record of your coin transactions (where you scanned or spent coins). We use it to run the event and the leaderboard. The leaderboard shows only your name and GitHub username.</li>
          <li><b>When you write to us</b> (to help out, speak, sponsor or ask a question): your name, email, GitHub username if you give it, and your message, so we can reply.</li>
          <li><b>Event feedback:</b> your rating and what you wrote. It is anonymous: we don&apos;t record who sent it.</li>
          <li><b>When something breaks:</b> if a page hits an error in your browser, it sends us the error message, the page address (without anything after a ? or #) and your browser&apos;s name, so we can fix it. Never what you typed, your email or your IP address.</li>
          <li><b>Emails we send:</b> a welcome message and event updates. Every email has an unsubscribe link, and you can unsubscribe with one click.</li>
        </L>

        <H>What we don&apos;t do</H>
        <L>
          <li>We don&apos;t sell or share your details with advertisers.</li>
          <li>We don&apos;t use advertising or tracking cookies. If we turn on site analytics, it is Vercel&apos;s cookie-free analytics, which doesn&apos;t identify you.</li>
          <li>We don&apos;t read your GitHub account beyond your public username and email shared through sign-in.</li>
        </L>

        <H>Who handles it for us</H>
        <L>
          <li><b>Supabase</b> stores sign-ups and Epoch data in a database.</li>
          <li><b>Vercel</b> hosts this website.</li>
          <li><b>Our email provider</b> (Gmail or Resend) delivers emails.</li>
          <li><b>GitHub</b> handles sign-in to Epoch. <b>Luma</b> and <b>WhatsApp</b> are separate services with their own privacy policies — if you register for an event on Luma or join our WhatsApp community, they hold that information, not us.</li>
        </L>

        <H>On your device</H>
        <P>Epoch keeps a sign-in session and a copy of your last wallet in your browser so it works with a weak signal. Nothing else is stored. Clearing your browser data removes it.</P>

        <H>How long we keep it</H>
        <P>Old data is deleted automatically once a week:</P>
        <L>
          <li><b>Sign-ups:</b> {RETENTION.signUpsMonths} months after you joined.</li>
          <li><b>Messages:</b> {RETENTION.messagesMonths} months after you sent them. <b>Event feedback:</b> {RETENTION.feedbackMonths} months.</li>
          <li><b>Error reports:</b> {RETENTION.errorsDays} days.</li>
          <li><b>Spam protection:</b> to stop scripts flooding our forms we count how often a form is sent from the same connection. We only keep a scrambled code, never your IP address, and only for a day.</li>
        </L>
        <P>Epoch data, and the Epoch dates list, are deleted by hand within 6 months after the event. Attendance (which events you came to) is kept so your certificates stay valid; ask us and we&apos;ll remove it.</P>

        <H>Your choices</H>
        <L>
          <li><b>Stop emails:</b> use the unsubscribe link in any email.</li>
          <li><b>See or delete your details:</b> contact us through {contact} and we&apos;ll remove them. Please tell us the email you used, and your GitHub username if you have one with us.</li>
        </L>

        <H>Photos</H>
        <P>We only publish photos of people who agreed. If you appear in a photo and want it removed, contact us and we&apos;ll take it down promptly. Photos are published without hidden location data.</P>

        <H>Questions</H>
        <P>Contact {contact}. This page may change as the club grows; we&apos;ll update the date above when it does.</P>
        <p className="mt-12"><Link href="/" className="font-semibold text-link">← Back to the club site</Link></p>
      </main>
      <SiteFooter />
    </>
  );
}
