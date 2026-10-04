import type { Metadata } from "next";
import KeystaticApp from "./keystatic";

/* The content editor (keystatic.config.ts). Its own app, so the site's smooth scrolling stays out of its way. */
export const metadata: Metadata = { title: "Content editor", robots: { index: false, follow: false } };

export default function Layout() {
  return <div data-lenis-prevent data-light-only><KeystaticApp /></div>;
}
