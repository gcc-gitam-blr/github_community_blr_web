import type { Mail } from "./templates";

/* One function to send an email, whichever service the club uses:
     1. Resend  — set RESEND_API_KEY            (needs a verified domain to email other people)
     2. SMTP    — set SMTP_HOST/PORT/USER/PASS  (works with a normal Gmail account + App Password)
   and EMAIL_FROM, e.g.  GitHub Community Club <club@gmail.com>.
   With neither configured, nothing is sent and the caller is told so — the site still works. */
export type Transport = (to: string, mail: Mail, headers: Record<string, string>) => Promise<void>;
/** `why` is the failure in words an organiser can act on; `error` is the raw message, for the server log. */
export type SendResult = { sent: true } | { sent: false; reason: "not-configured" | "failed"; error?: string; why?: string };
type SendOpts = { unsubscribe?: string; replyTo?: string; transport?: Transport };

export const emailConfigured = () => Boolean(process.env.EMAIL_FROM && (process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)));

/** What went wrong, in one sentence that says what to do. The common ones are Gmail's: a cancelled App Password,
    the daily limit, and slowing down after a burst. */
export function explain(error: string): string {
  if (/\b534\b|5\.7\.9|Application-specific password required/i.test(error)) return "Gmail wants an App Password, not the account's normal password. Make one at myaccount.google.com/apppasswords, put it in SMTP_PASS in Vercel and redeploy.";
  if (/\b535\b|Invalid login|Username and Password not accepted|BadCredentials|authentication failed/i.test(error)) return "Gmail refused the login: the App Password in SMTP_PASS is wrong or was cancelled (changing the Google account's password or turning off 2-Step Verification cancels it). Make a new one at myaccount.google.com/apppasswords, put it in SMTP_PASS in Vercel and redeploy.";
  if (/5\.4\.5|sending (limit|quota)|Daily user sending/i.test(error)) return "The email account has reached its daily sending limit (Gmail allows about 500 a day). Send the rest tomorrow: people who already got theirs are remembered.";
  if (/\b(421|454)\b|Too many login attempts|try again later/i.test(error)) return "The mail server is slowing us down for now. Wait ten minutes and send again: people who already got theirs are remembered.";
  if (/only send testing emails|verify a domain|domain is not verified/i.test(error)) return "Resend only emails other people once the club's domain is verified there. Verify it in Resend, or use Gmail instead (see the README).";
  if (/Resend 40[13]/.test(error)) return "Resend refused the request: check RESEND_API_KEY in Vercel.";
  if (/ETIMEDOUT|ECONNECTION|ECONNREFUSED|ENOTFOUND|ESOCKET|EDNS/.test(error)) return "Couldn't reach the mail server: check SMTP_HOST and SMTP_PORT in Vercel.";
  return `The email service said: ${error.split("\n")[0].slice(0, 160)}`;
}
const message = (e: unknown) => [(e as { code?: string }).code, e instanceof Error ? e.message : String(e)].filter(Boolean).join(" ");

const viaResend: Transport = async (to, mail, headers) => {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject: mail.subject, html: mail.html, text: mail.text, headers }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
};

const smtpOptions = (pool: boolean) => {
  const port = Number(process.env.SMTP_PORT || 465);
  return { host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, ...(pool ? { pool: true, maxConnections: 2, maxMessages: 500 } : {}) };
};
type Smtp = { sendMail: (m: object) => Promise<unknown> };
const smtpSend = (t: Smtp, to: string, mail: Mail, headers: Record<string, string>) => t.sendMail({ from: process.env.EMAIL_FROM, to, subject: mail.subject, html: mail.html, text: mail.text, headers }).then(() => undefined);

const viaSmtp: Transport = async (to, mail, headers) => {
  const nodemailer = (await import("nodemailer")).default;
  await smtpSend(nodemailer.createTransport(smtpOptions(false)), to, mail, headers);
};

export async function sendEmail(to: string, mail: Mail, opts: SendOpts = {}): Promise<SendResult> {
  const transport = opts.transport ?? (process.env.RESEND_API_KEY ? viaResend : process.env.SMTP_HOST ? viaSmtp : null);
  if (!transport || !(opts.transport || emailConfigured())) return { sent: false, reason: "not-configured" };
  // lets Gmail/Outlook show their own "Unsubscribe" button
  const headers: Record<string, string> = opts.unsubscribe ? { "List-Unsubscribe": `<${opts.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {};
  if (opts.replyTo) headers["Reply-To"] = opts.replyTo;
  try { await transport(to, mail, headers); return { sent: true }; }
  catch (e) { const error = message(e); return { sent: false, reason: "failed", error, why: explain(error) }; }
}

export interface BatchMailer {
  /** Logs in once before anything is sent: null if it works, otherwise what's wrong (in words). */
  check: () => Promise<string | null>;
  send: (to: string, mail: Mail, opts?: Omit<SendOpts, "transport">) => Promise<SendResult>;
  close: () => void;
}
/** For many emails at once (certificates, a broadcast). Over SMTP it keeps one or two connections open for the whole
    batch instead of logging in for every email, which Gmail turns away when it comes in bursts; and `check()` tries the
    login first, so a wrong password stops the batch before anyone is counted as failed. Always `close()` it. */
export async function batchMailer(): Promise<BatchMailer> {
  if (process.env.RESEND_API_KEY || !process.env.SMTP_HOST) return { check: async () => null, send: (to, mail, o) => sendEmail(to, mail, o), close: () => {} };
  const nodemailer = (await import("nodemailer")).default;
  const t = nodemailer.createTransport(smtpOptions(true));
  const transport: Transport = (to, mail, headers) => smtpSend(t, to, mail, headers);
  return {
    async check() {
      try { await t.verify(); return null; }
      catch (e) { const error = message(e); console.error("email login failed:", error); return explain(error); }
    },
    send: (to, mail, o = {}) => sendEmail(to, mail, { ...o, transport }),
    close: () => t.close(),
  };
}
