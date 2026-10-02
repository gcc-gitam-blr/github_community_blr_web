import { CLUB } from "../config";

/* Plain, readable HTML emails (inline styles — email clients ignore stylesheets) plus a text version.
   Everything a person typed is escaped before it goes into the HTML. */
export interface Mail { subject: string; html: string; text: string }

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const GREEN = "#2ea043", INK = "#0b0b0f";

function frame(preheader: string, inner: string, site: string, unsubscribe?: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f8fa;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${INK}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #d0d7de;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:22px 28px;border-bottom:1px solid #d0d7de"><b style="font-size:17px">GitHub Community</b> <span style="background:${GREEN};color:${INK};font-weight:800;border-radius:4px;padding:1px 7px;font-size:14px">BLR</span></td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.6">${inner}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #d0d7de;font-size:12.5px;line-height:1.6;color:#59636e">
${esc(CLUB.name)} · ${esc(CLUB.university)}<br>
<a href="${site}" style="color:#59636e">${site.replace(/^https?:\/\//, "")}</a>${unsubscribe ? ` · <a href="${unsubscribe}" style="color:#59636e">Unsubscribe</a>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:${GREEN};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">${esc(label)}</a></p>`;

export interface WelcomeInput { handle: string; firstEventTitle?: string; nextEvent?: { title: string; date: string; url?: string }; site: string; unsubscribe: string }

export function welcomeEmail(i: WelcomeInput): Mail {
  const wa = CLUB.joinUrl;
  const next = i.nextEvent ? `<p><b>Next up:</b> ${esc(i.nextEvent.title)} — ${esc(i.nextEvent.date)}${i.nextEvent.url ? ` · <a href="${i.nextEvent.url}" style="color:#0969da">RSVP</a>` : ""}</p>` : "";
  const html = frame(`Welcome to the club, @${i.handle}`, `
<h1 style="font-size:24px;line-height:1.25;margin:0 0 12px">Welcome to the club, @${esc(i.handle)} 👋</h1>
<p>Your pull request into <code>club:main</code> is merged. You're in — no experience needed, just curiosity.</p>
${i.firstEventTitle ? `<p>You said you want to try <b>${esc(i.firstEventTitle)}</b> first. We'll remind you before it.</p>` : ""}
${next}
<p><b>Do this next:</b></p>
<ol style="padding-left:20px;margin:0 0 8px">
${wa ? `<li>Join our WhatsApp community — it's where we share dates, workshops and RSVP links.</li>` : ""}
<li>Make sure you have a GitHub account (free) — it's what we'll use in every session.</li>
<li>Bring a laptop and a charger to the first session.</li>
</ol>
${wa ? button(wa, "Join the WhatsApp community") : ""}
<p>Questions? Just reply, or find us on Instagram and LinkedIn. See you soon!</p>
<p style="margin-bottom:0">— The GitHub Community Club team</p>`, i.site, i.unsubscribe);
  const text = [
    `Welcome to the club, @${i.handle}!`, "",
    "Your pull request into club:main is merged. You're in — no experience needed, just curiosity.",
    i.firstEventTitle ? `You said you want to try "${i.firstEventTitle}" first. We'll remind you before it.` : "",
    i.nextEvent ? `Next up: ${i.nextEvent.title} — ${i.nextEvent.date}${i.nextEvent.url ? ` (${i.nextEvent.url})` : ""}` : "", "",
    "Do this next:",
    wa ? `1. Join our WhatsApp community (dates, workshops, RSVP links): ${wa}` : "",
    "2. Make sure you have a free GitHub account.",
    "3. Bring a laptop and a charger to the first session.", "",
    "— The GitHub Community Club team", "", `${CLUB.name} · ${i.site}`, `Unsubscribe: ${i.unsubscribe}`,
  ].filter((l) => l !== "").join("\n");
  return { subject: "Welcome to the GitHub Community Club 🎉", html, text };
}

/** To the club inbox: someone used the Get involved form. */
export function contactNotification(i: { kindLabel: string; name: string; email: string; handle?: string; message: string; site: string }): Mail {
  const inner = `<h1 style="font-size:20px;margin:0 0 14px">New message: ${esc(i.kindLabel)}</h1>
<p style="margin:0 0 4px"><b>${esc(i.name)}</b> · <a href="mailto:${esc(i.email)}" style="color:#0969da">${esc(i.email)}</a></p>
${i.handle ? `<p style="margin:0 0 14px">GitHub: <a href="https://github.com/${esc(i.handle)}" style="color:#0969da">@${esc(i.handle)}</a></p>` : ""}
<div style="white-space:pre-wrap;background:#f6f8fa;border-radius:8px;padding:14px 16px">${esc(i.message)}</div>
<p style="color:#59636e;font-size:14px">Reply to this email to answer them directly.</p>`;
  return { subject: `[${i.kindLabel}] ${i.name}`, html: frame(`${i.name} sent a message`, inner, i.site), text: `${i.kindLabel}
From: ${i.name} <${i.email}>${i.handle ? `
GitHub: @${i.handle}` : ""}

${i.message}` };
}

/** To the sender: a short "we got it". */
export function contactAck(i: { name: string; kindLabel: string; site: string }): Mail {
  const first = i.name.trim().split(/s+/)[0];
  const html = frame("We got your message", `<h1 style="font-size:22px;margin:0 0 12px">Thanks, ${esc(first)} — we got it.</h1>
<p>Your message (<i>${esc(i.kindLabel)}</i>) reached the GitHub Community Club team. A real person will reply, usually within a few days.</p>
<p>Meanwhile, our WhatsApp community is the quickest way to see what's happening.</p>
${CLUB.joinUrl ? button(CLUB.joinUrl, "Join the WhatsApp community") : ""}
<p style="margin-bottom:0">— The GitHub Community Club team</p>`, i.site);
  return { subject: "We got your message", html, text: `Thanks, ${first} — we got your message (${i.kindLabel}). A real person will reply, usually within a few days.

${CLUB.name} · ${i.site}` };
}

export interface BroadcastInput { subject: string; message: string; site: string; unsubscribe: string }

/** A message from the organisers. Blank lines start new paragraphs; URLs become links. */
export function broadcastEmail(i: BroadcastInput): Mail {
  const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#0969da">${u}</a>`);
  const paras = i.message.trim().split(/\n{2,}/).map((p) => `<p>${linkify(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html = frame(i.subject, `<h1 style="font-size:22px;line-height:1.3;margin:0 0 14px">${esc(i.subject)}</h1>${paras}<p style="margin-bottom:0">— The GitHub Community Club team</p>`, i.site, i.unsubscribe);
  const text = `${i.subject}\n\n${i.message.trim()}\n\n— The GitHub Community Club team\n\n${CLUB.name} · ${i.site}\nUnsubscribe: ${i.unsubscribe}`;
  return { subject: i.subject, html, text };
}

export interface CertificateInput { name: string; eventTitle: string; url: string; linkedin: string; site: string }

/** Sent by an admin after an event, only to people marked as attended. */
export function certificateEmail(i: CertificateInput): Mail {
  const html = frame(`Your certificate for ${i.eventTitle}`, `
<h1 style="font-size:24px;line-height:1.25;margin:0 0 12px">Thanks for coming, ${esc(i.name.split(" ")[0])} 🎉</h1>
<p>Here's your certificate of participation for <b>${esc(i.eventTitle)}</b>. Open it to download a PDF or print it.</p>
${button(i.url, "View your certificate")}
<p>Add it to your LinkedIn profile in one click: <a href="${i.linkedin}" style="color:#0969da">Add to LinkedIn</a>.</p>
<p style="color:#59636e;font-size:14px">Anyone can check it's genuine at the link above — it stays online.</p>
<p>See you at the next one!</p>`, i.site);
  const text = `Thanks for coming, ${i.name.split(" ")[0]}!\n\nYour certificate of participation for ${i.eventTitle}:\n${i.url}\n\nAdd it to LinkedIn: ${i.linkedin}\n\nSee you at the next one!\n— ${CLUB.name}`;
  return { subject: `Your certificate: ${i.eventTitle}`, html, text };
}
