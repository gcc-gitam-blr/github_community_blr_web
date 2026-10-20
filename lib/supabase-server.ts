import { createClient } from "@supabase/supabase-js";

/* The database client for our API routes (server only; never import this from a component). The public forms write
   through functions only the server key may run (submit_join, submit_message, submit_feedback in supabase/schema.sql),
   so the honeypot and rate limit can't be skipped by calling Supabase straight from a browser. Without
   SUPABASE_SERVICE_ROLE_KEY it falls back to the public key: reads still work, but those writes are refused. */
export function serverDb() {
  // SUPABASE_URL (server only, read at run time) lets the browser tests point the server at a local copy of the schema
  // (tests/e2e/fake-supabase.ts); the live site doesn't set it and uses NEXT_PUBLIC_SUPABASE_URL as always
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}
