import { CLUB } from "../config";
import { digestHeadline, type Digest } from "../digest";

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

/** `finish`: the signed link where they add their GitHub username and first event (optional, any time). */
export interface WelcomeInput { name: string; handle?: string; firstEventTitle?: string; nextEvent?: { title: string; date: string; url?: string }; finish?: string; site: string; unsubscribe: string }

export function welcomeEmail(i: WelcomeInput): Mail {
  const wa = CLUB.joinUrl, first = i.name.trim().split(/\s+/)[0] || "there";
  const next = i.nextEvent ? `<p><b>Next up:</b> ${esc(i.nextEvent.title)}, ${esc(i.nextEvent.date)}${i.nextEvent.url ? ` · <a href="${i.nextEvent.url}" style="color:#0969da">RSVP</a>` : ""}</p>` : "";
  const steps = [
    wa && `Join the WhatsApp community: dates, workshops and RSVP links land there first.`,
    `Make a free GitHub account if you don't have one. Every session uses it.`,
    i.finish && !i.handle && `<a href="${i.finish}" style="color:#0969da">Add your GitHub username</a> so we can follow your first contributions (one minute, whenever you like).`,
  ].filter(Boolean) as string[];
  const html = frame(`You're in, ${first}`, `
<h1 style="font-size:24px;line-height:1.25;margin:0 0 12px">You're in, ${esc(first)} 👋</h1>
<p>Welcome to the GitHub Community Club. No experience needed: every session starts from zero, and you'll open your first pull request with people who've done it before.</p>
${i.firstEventTitle ? `<p>You'd like to try <b>${esc(i.firstEventTitle)}</b> first. We'll remind you before it.</p>` : ""}
${next}
<p><b>Three small things:</b></p>
<ol style="padding-left:20px;margin:0 0 8px">${steps.map((x) => `<li>${x}</li>`).join("")}</ol>
${wa ? button(wa, "Join the WhatsApp community") : ""}
<p>Questions? Reply to this email. A real person on the team reads it.</p>
<p style="margin-bottom:0">The GitHub Community Club team</p>`, i.site, i.unsubscribe);
  const text = [
    `You're in, ${first}!`, "",
    "Welcome to the GitHub Community Club. No experience needed: every session starts from zero.",
    i.firstEventTitle ? `You'd like to try "${i.firstEventTitle}" first. We'll remind you before it.` : "",
    i.nextEvent ? `Next up: ${i.nextEvent.title}, ${i.nextEvent.date}${i.nextEvent.url ? ` (${i.nextEvent.url})` : ""}` : "", "",
    "Three small things:",
    wa ? `- Join the WhatsApp community: ${wa}` : "",
    "- Make a free GitHub account if you don't have one.",
    i.finish && !i.handle ? `- Add your GitHub username (one minute): ${i.finish}` : "", "",
    "Questions? Reply to this email.", "", "The GitHub Community Club team", "", `${CLUB.name} · ${i.site}`, `Unsubscribe: ${i.unsubscribe}`,
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
  const first = i.name.trim().split(/\s+/)[0];
  const html = frame("We got your message", `<h1 style="font-size:22px;margin:0 0 12px">Thanks, ${esc(first)}. We got it.</h1>
<p>Your message (<i>${esc(i.kindLabel)}</i>) reached the GitHub Community Club team. A real person will reply, usually within a few days.</p>
<p>Meanwhile, our WhatsApp community is the quickest way to see what's happening.</p>
${CLUB.joinUrl ? button(CLUB.joinUrl, "Join the WhatsApp community") : ""}
<p style="margin-bottom:0">The GitHub Community Club team</p>`, i.site);
  return { subject: "We got your message", html, text: `Thanks, ${first}. We got your message (${i.kindLabel}). A real person will reply, usually within a few days.

${CLUB.name} · ${i.site}` };
}

export interface BroadcastInput { subject: string; message: string; site: string; unsubscribe: string }

/** A message from the organisers. Blank lines start new paragraphs; URLs become links. */
export function broadcastEmail(i: BroadcastInput): Mail {
  const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#0969da">${u}</a>`);
  const paras = i.message.trim().split(/\n{2,}/).map((p) => `<p>${linkify(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html = frame(i.subject, `<h1 style="font-size:22px;line-height:1.3;margin:0 0 14px">${esc(i.subject)}</h1>${paras}<p style="margin-bottom:0">The GitHub Community Club team</p>`, i.site, i.unsubscribe);
  const text = `${i.subject}\n\n${i.message.trim()}\n\nThe GitHub Community Club team\n\n${CLUB.name} · ${i.site}\nUnsubscribe: ${i.unsubscribe}`;
  return { subject: i.subject, html, text };
}

export interface ApplicantInput { name: string; round: string; subject: string; message: string; site: string }

/** To one applicant of a recruitment round, from Admin → Recruitment: a personal greeting, then the organisers' message.
    No unsubscribe link: it's about their own application, not a mailing list. Replies go to the club's address. */
export function applicantEmail(i: ApplicantInput): Mail {
  const first = i.name.trim().split(/\s+/)[0] || "there";
  const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#0969da">${u}</a>`);
  const paras = i.message.trim().split(/\n{2,}/).map((p) => `<p>${linkify(p).replace(/\n/g, "<br>")}</p>`).join("");
  const about = `About your application to ${i.round}. Reply to this email if you have a question.`;
  const html = frame(i.subject, `<p>Hi ${esc(first)},</p>${paras}<p>The GitHub Community Club team</p><p style="color:#59636e;font-size:14px;margin-bottom:0">${esc(about)}</p>`, i.site);
  const text = `Hi ${first},\n\n${i.message.trim()}\n\nThe GitHub Community Club team\n\n${about}\n${CLUB.name} · ${i.site}`;
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
<p style="color:#59636e;font-size:14px">Anyone can check it's genuine at the link above. It stays online.</p>
<p>See you at the next one!</p>`, i.site);
  const text = `Thanks for coming, ${i.name.split(" ")[0]}!\n\nYour certificate of participation for ${i.eventTitle}:\n${i.url}\n\nAdd it to LinkedIn: ${i.linkedin}\n\nSee you at the next one!\nThe ${CLUB.name} team`;
  return { subject: `Your certificate: ${i.eventTitle}`, html, text };
}

/** Monday morning, to organisers: the past week on the site, in a few lines, with a link to /admin. */
export function digestEmail(d: Digest, site: string): Mail {
  const day = (s: string) => new Date(`${s}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const week = `${day(d.from)} – ${day(d.to)}`, admin = `${site}/admin`;
  const more = d.signups.count - d.signups.first.length;
  const handles = d.signups.first.join(", ") + (more > 0 ? ` and ${more} more` : "");
  const lines: [string, string][] = [];
  if (d.signups.count) lines.push([`New sign-ups: ${d.signups.count}`, handles]);
  if (d.messages.length) lines.push(["Get involved messages", d.messages.map((m) => `${m.label}: ${m.count}`).join(" · ")]);
  for (const f of d.feedback) lines.push([`Feedback: ${f.event}`, `${f.average} / 5 from ${f.count} ${f.count === 1 ? "rating" : "ratings"}`]);
  if (d.access?.tooFewAdmins) lines.push(["Access: too few admins", `${d.access.activeAdmins} active ${d.access.activeAdmins === 1 ? "admin" : "admins"}. Appoint another under People & roles so the club is never locked out.`]);
  const some = <T,>(xs: T[], f: (x: T) => string) => xs.slice(0, 5).map(f).join(" · ") + (xs.length > 5 ? ` · and ${xs.length - 5} more` : "");
  if (d.tasks?.overdue.length) lines.push([`Overdue tasks: ${d.tasks.overdue.length}`, some(d.tasks.overdue, (t) => `${t.title} (@${t.owner}, ${t.days} ${t.days === 1 ? "day" : "days"} late)`)]);
  if (d.tasks?.orphaned.length) lines.push([`Tasks to reassign: ${d.tasks.orphaned.length}`, "Their owner no longer has access. " + some(d.tasks.orphaned, (t) => `${t.title} (@${t.owner})`)]);
  if (d.policies) lines.push([`Policy reviews due: ${d.policies.length}`, some(d.policies, (p) => `${p.title} (${p.days} ${p.days === 1 ? "day" : "days"} past its review date)`)]);
  if (d.assets) lines.push([`Assets to check: ${d.assets.length}`, some(d.assets, (a) => `${a.name} ${a.what}`)]);
  if (d.access?.ending.length) lines.push(["Access ending within 14 days", d.access.ending.map((e) => `@${e.handle} (${e.role}) ${e.daysLeft === 0 ? "ends today" : `in ${e.daysLeft} ${e.daysLeft === 1 ? "day" : "days"}`}`).join(" · ")]);
  const rows = lines.map(([k, v]) => `<tr><td style="padding:10px 0;border-top:1px solid #d0d7de"><b>${esc(k)}</b><br><span style="color:#59636e">${esc(v)}</span></td></tr>`).join("");
  const html = frame(`The club's week: ${digestHeadline(d)}`, `<h1 style="font-size:22px;line-height:1.3;margin:0 0 6px">The club&#39;s week</h1>
<p style="margin:0 0 14px;color:#59636e;font-family:ui-monospace,Menlo,monospace;font-size:14px">${esc(week)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
${button(admin, "Open the organiser dashboard")}
<p style="margin-bottom:0;color:#59636e;font-size:14px">Sent every Monday to organisers, only when something happened or someone&#39;s access needs attention.</p>`, site);
  const text = [`The club's week (${week})`, "", ...lines.map(([k, v]) => `${k}\n  ${v}`), "", `Organiser dashboard: ${admin}`].join("\n");
  return { subject: `Club week: ${digestHeadline(d)}`, html, text };
}
