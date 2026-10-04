import { makeRouteHandler } from "@keystatic/next/route-handler";
import config from "../../../../keystatic.config";

/* The content editor's server side: GitHub sign-in and saving (or, locally, writing files).
   Until its GitHub App is set up (KEYSTATIC_* in Vercel, see CONTRIBUTING.md) it answers "not connected"
   instead of failing the whole build. */
// on your laptop (npm run dev) it always runs: that's where Keystatic's one-time "Create GitHub App" setup happens
const connected = config.storage.kind !== "github" || process.env.NODE_ENV === "development"
  || !!(process.env.KEYSTATIC_GITHUB_CLIENT_ID && process.env.KEYSTATIC_GITHUB_CLIENT_SECRET && process.env.KEYSTATIC_SECRET);
const notConnected = () => Response.json({ error: "The content editor isn't connected to GitHub yet." }, { status: 503 });

export const { POST, GET } = connected ? makeRouteHandler({ config }) : { POST: notConnected, GET: notConnected };
