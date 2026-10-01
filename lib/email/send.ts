import type { Mail } from "./templates";

/* One function to send an email, whichever service the club uses:
     1. Resend  — set RESEND_API_KEY            (needs a verified domain to email other people)
     2. SMTP    — set SMTP_HOST/PORT/USER/PASS  (works with a normal Gmail account + App Password)
   and EMAIL_FROM, e.g.  GitHub Community Club <club@gmail.com>.
   With neither configured, nothing is sent and the caller is told so — the site still works. */
export type Transport = (to: string, mail: Mail, headers: Record<string, string>) => Promise<void>;
export type SendResult = { sent: true } | { sent: false; reason: "not-configured" | "failed"; error?: string };

export const emailConfigured = () => Boolean(process.env.EMAIL_FROM && (process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)));

const viaResend: Transport = async (to, mail, headers) => {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject: mail.subject, html: mail.html, text: mail.text, headers }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
};

const viaSmtp: Transport = async (to, mail, headers) => {
  const nodemailer = (await import("nodemailer")).default;
  const port = Number(process.env.SMTP_PORT || 465);
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await t.sendMail({ from: process.env.EMAIL_FROM, to, subject: mail.subject, html: mail.html, text: mail.text, headers });
};

export async function sendEmail(to: string, mail: Mail, opts: { unsubscribe?: string; transport?: Transport } = {}): Promise<SendResult> {
  const transport = opts.transport ?? (process.env.RESEND_API_KEY ? viaResend : process.env.SMTP_HOST ? viaSmtp : null);
  if (!transport || !(opts.transport || emailConfigured())) return { sent: false, reason: "not-configured" };
  // lets Gmail/Outlook show their own "Unsubscribe" button
  const headers: Record<string, string> = opts.unsubscribe ? { "List-Unsubscribe": `<${opts.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {};
  try { await transport(to, mail, headers); return { sent: true }; }
  catch (e) { return { sent: false, reason: "failed", error: e instanceof Error ? e.message : String(e) }; }
}
