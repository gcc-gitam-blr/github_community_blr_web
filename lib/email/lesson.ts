import { CLUB } from "../config";
import { greetName } from "../attendance";
import { LESSONS, type Lesson, type Line } from "../lessons";
import { esc, type Mail } from "./templates";

/* The weekly newsletter, as a one-minute lesson: a puzzle, a pause, the problem, the fix, one habit, a one-tap question,
   then what's next at the club. It wears the site's own look: the same palette, Mona Sans and JetBrains Mono where
   they're installed (no web-font download: an outside stylesheet counts against an email in spam filters), and the
   commit-graph nodes from the site's menu, so each part of the lesson reads like a commit on a branch. Inline styles and tables only (email apps ignore stylesheets). The pictures are the club's Octodex
   stickers, loaded from the site; where an app doesn't show images, their alt text stands in. */
export interface AgendaItem { when: string; title: string; where?: string; url: string }
export interface LessonInput {
  lesson: Lesson;
  name?: string | null;
  site: string;
  unsubscribe: string;
  why: string;
  note?: string; // an optional few lines from the team, shown under the greeting
  agenda?: { lead: string; items: AgendaItem[] }; // "This week" or "Next up", with the events under it
}

// the site's tokens (app/globals.css), written out because email can't read CSS variables
const T = {
  ink: "#0b0b0f", ink2: "#3a3d44", ink3: "#666a73", line: "#e4e8e6", soft: "#f5f7f6", paper: "#ffffff",
  brand: "#3fc84e", brandDeep: "#1a7f37", link: "#1230e0", red: "#cf222e", purple: "#8250df", purpleNode: "#b48be6",
  mint: "#4fd1a1", blue: "#b9e0f7", gold: "#ffc933", goldDeep: "#c98a00", night: "#0a0a14", night2: "#12121f", fog: "#a3a4bd",
};
const SANS = "'Mona Sans',-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Consolas,Menlo,monospace";
const ALT: Record<string, string> = {
  bouncer: "Octocat in sunglasses, arms crossed", deckfail: "Octocat holding a sign that says DeckFail",
  heart: "Octocat between two friendly snakes, with a heart", agenda: "Octocat holding a clipboard",
};

const table = (inner: string, style = "") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${style}">${inner}</table>`;
const sticker = (site: string, name: string, size: number) =>
  `<img src="${site}/stickers/${name}-240.webp" width="${size}" height="${size}" alt="${esc(ALT[name] ?? "Octocat")}" style="display:block;border:0;outline:none">`;
const gap = (px: number) => table(`<tr><td height="${px}" style="height:${px}px;line-height:${px}px;font-size:1px">&nbsp;</td></tr>`);
const dot = (fill: string, ring = fill) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${fill};border:2px solid ${ring}"></span>`;

/** One part of the lesson as a commit-graph node: a node in the part's colour, its label, then the content. */
const commit = (color: string, label: string, body: string, last = false) => table(`<tr>
<td width="14" valign="top" style="width:14px;padding-top:3px;">${dot(T.paper, color)}</td>
<td valign="top" style="padding:0 0 ${last ? 0 : 30}px 16px">
<p style="margin:0 0 10px;font-family:${MONO};font-size:11.5px;font-weight:700;letter-spacing:.12em;color:${color}">${label}</p>${body}</td></tr>`);

/** A terminal in the site's night colours: the command on top, then the lines. `tone` marks it as before (✗) or after (✓). */
function terminal(t: { cmd: string; lines: Line[] }, tone: "before" | "after") {
  const bad = tone === "before", chip = bad ? `<span style="color:#ff7b72">✗ before</span>` : `<span style="color:${T.mint}">✓ after</span>`;
  const rows = t.lines.map(([d, s]) => `<tr>${d ? `<td valign="top" style="padding:3px 14px 3px 0;color:${T.fog};font-family:${MONO};font-variant-ligatures:none;font-size:12.5px;white-space:nowrap">${esc(d)}</td>` : ""}<td valign="top" colspan="${d ? 1 : 2}" style="padding:3px 0;color:#e6edf3;font-family:${MONO};font-variant-ligatures:none;font-size:12.5px;line-height:1.5">${esc(s)}</td></tr>`).join("");
  return table(`<tr><td style="background:${T.night};border-radius:12px;padding:0">
${table(`<tr><td style="padding:10px 16px;border-bottom:1px solid ${T.night2}">${dot("#ff5f57")}&nbsp;${dot("#febc2e")}&nbsp;${dot("#28c840")}<span style="font-family:${MONO};font-size:12px;color:${T.fog};padding-left:12px;white-space:nowrap">${esc(t.cmd)}</span></td>
<td align="right" style="padding:10px 16px;border-bottom:1px solid ${T.night2};font-family:${MONO};font-size:11.5px;font-weight:700;white-space:nowrap">${chip}</td></tr>`)}
<div style="padding:14px 16px 16px">${table(rows)}</div></td></tr>`, "margin:4px 0 16px");
}

/** A card with a coloured edge, like a note in the margin. */
const card = (tag: string, title: string, text: string, accent: string, bg: string) => table(`<tr><td style="border-left:4px solid ${accent};border-radius:10px;padding:14px 18px;background:${bg}">
<p style="margin:0 0 4px;font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:.12em;color:${accent}">${esc(tag)}</p>
<p style="margin:0 0 4px;font-size:17px;font-weight:800;line-height:1.3;color:${T.ink}">${esc(title)}</p>
${text ? `<p style="margin:0;font-size:15px;line-height:1.55;color:${T.ink2}">${esc(text)}</p>` : ""}</td></tr>`, "margin:0 0 14px");

const pill = (href: string, text: string, filled: boolean) =>
  `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;border:2px solid ${T.ink};border-radius:999px;padding:9px 20px;color:${filled ? T.paper : T.ink};background:${filled ? T.ink : T.paper};font-weight:700;font-size:15px;text-decoration:none">${esc(text)}</a>`;

/** "No. 3": where this lesson sits in the series. */
export const lessonNumber = (l: Lesson) => LESSONS.findIndex((x) => x.slug === l.slug) + 1;

export function lessonEmail(i: LessonInput): Mail {
  const { lesson: l, site } = i;
  const first = greetName(i.name ?? "");
  const hey = first ? `Hey ${esc(first)},` : "Hey,";
  const vote = (answer: string) => `mailto:${CLUB.email}?subject=${encodeURIComponent(`Poll: ${l.slug}, ${answer}`)}`;
  const note = (i.note ?? "").trim();
  const no = lessonNumber(l);
  const p = (html: string, extra = "") => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${T.ink};${extra}">${html}</p>`;

  const agenda = i.agenda?.items.length ? table(`<tr><td style="background:${T.soft};border:1px solid ${T.line};border-radius:14px;padding:18px 20px">
${table(`<tr><td valign="top" width="72" style="width:72px">${sticker(site, "agenda", 60)}</td><td valign="top" style="padding-left:14px">
<p style="margin:0 0 8px;font-family:${MONO};font-size:11.5px;font-weight:700;letter-spacing:.12em;color:${T.brandDeep}">${esc(i.agenda.lead.toUpperCase())} AT THE CLUB</p>
${i.agenda.items.map((e) => `<p style="margin:0 0 10px;font-size:15.5px;line-height:1.45;color:${T.ink}"><b>${esc(e.when)}</b> &middot; <a href="${e.url}" style="color:${T.link};font-weight:700">${esc(e.title)}</a>${e.where ? `<br><span style="color:${T.ink3};font-size:14px">${esc(e.where)}</span>` : ""}</p>`).join("")}
</td></tr>`)}</td></tr>`, "margin-top:34px") : "";

  const puzzle = `${p(esc(l.setup))}${terminal(l.before, "before")}
<p style="margin:6px 0 10px;font-size:20px;font-weight:800;line-height:1.3;color:${T.ink}">${esc(l.question)}</p>
<p style="margin:0;font-size:15px;line-height:1.55;color:${T.ink2}"><span style="font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:.12em;color:${T.ink3}">HINT&nbsp;&nbsp;</span>${esc(l.hint)}</p>`;

  const pause = table(`<tr><td align="center" style="padding:26px 0 0">${sticker(site, "bouncer", 92)}
<p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:${T.ink2};text-align:center">Take 30 seconds. No cheating.<br>Got your answer? Scroll down.</p>
<p style="margin:14px 0 0;font-family:${MONO};font-size:16px;letter-spacing:.4em;color:${T.line};text-align:center">&#8942;</p></td></tr>`);

  const problem = table(`<tr><td valign="top"><p style="margin:0 0 8px;font-size:19px;font-weight:800;line-height:1.3;color:${T.ink}">${esc(l.problem.title)}</p>
<p style="margin:0;font-size:16px;line-height:1.6;color:${T.ink2}">${esc(l.problem.text)}</p></td>
<td valign="top" width="96" style="width:96px;padding-left:14px">${sticker(site, "deckfail", 84)}</td></tr>`);

  const solution = `${l.steps.map((s, n) => table(`<tr><td valign="top" width="30" style="width:30px"><span style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:50%;background:${T.ink};color:${T.paper};font-size:13px;font-weight:800;text-align:center">${n + 1}</span></td>
<td valign="top" style="padding:1px 0 12px 8px"><p style="margin:0;font-size:16px;font-weight:800;line-height:1.4;color:${T.ink}">${esc(s.title)}</p><p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:${T.ink2}">${esc(s.note)}</p></td></tr>`)).join("")}
${terminal(l.after, "after")}`;

  const takeaways = `${card("GIT HABIT", l.habit.title, l.habit.text, T.purple, "#f6f3fb")}${card("IN ONE LINE", l.summary, "", T.goldDeep, "#fff8e1")}`;

  const poll = table(`<tr><td valign="top" width="96" style="width:96px;padding-right:14px">${sticker(site, "heart", 84)}</td>
<td valign="top"><p style="margin:0 0 12px;font-size:17px;font-weight:800;line-height:1.35;color:${T.ink}">${esc(l.poll.question)}</p>
${pill(vote("yes"), l.poll.yes, true)}${pill(vote("no"), l.poll.no, false)}
<p style="margin:4px 0 0;font-size:13.5px;line-height:1.5;color:${T.ink3}">One tap opens a ready-made reply. It tells us what to teach next.</p></td></tr>`);

  const inner = `
${p(hey)}
${note ? table(`<tr><td style="border:1px solid ${T.line};border-radius:12px;padding:14px 18px;background:${T.paper}"><p style="margin:0 0 6px;font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:.12em;color:${T.brandDeep}">FROM THE TEAM</p><p style="margin:0;font-size:15.5px;line-height:1.6;color:${T.ink}">${esc(note).replace(/\n/g, "<br>")}</p></td></tr>`, "margin:0 0 20px") : ""}
${commit(T.link, "THE PUZZLE", puzzle, true)}
${pause}
${gap(90)}
${commit(T.red, "THE PROBLEM", problem)}
${commit(T.brandDeep, "THE FIX", solution, true)}
${gap(10)}
${takeaways}
${gap(18)}
${poll}
${agenda}
<p style="margin:34px 0 0;font-size:16px;line-height:1.6;color:${T.ink}">See you next week,<br><b>The GitHub Community Club team</b></p>`;

  const graph = `${dot(T.blue)}<span style="display:inline-block;width:18px;height:2px;background:${T.line};vertical-align:middle;margin:0 3px"></span>${dot(T.purpleNode)}<span style="display:inline-block;width:18px;height:2px;background:${T.line};vertical-align:middle;margin:0 3px"></span>${dot(T.mint)}<span style="display:inline-block;width:18px;height:2px;background:${T.line};vertical-align:middle;margin:0 3px"></span>${dot(T.brand)}`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>${esc(l.subject)}</title></head>
<body style="margin:0;padding:0;background:${T.soft};font-family:${SANS};color:${T.ink};-webkit-text-size-adjust:100%">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(l.preheader)}</span>
${table(`<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;border-collapse:separate">
<tr><td style="padding:0 4px 14px">${table(`<tr><td><b style="font-size:16px;color:${T.ink}">GitHub Community</b>&nbsp;<span style="background:${T.brand};color:${T.ink};font-weight:800;border-radius:6px;padding:2px 8px;font-size:13px">BLR</span></td><td align="right">${graph}</td></tr>`)}</td></tr>
<tr><td style="background:${T.paper};border:1px solid ${T.line};border-radius:18px;padding:0">
${table(`<tr><td style="padding:26px 28px 22px;border-bottom:1px solid ${T.line}">
<p style="margin:0 0 6px;font-family:${MONO};font-size:12px;color:${T.ink3}">Git in 60 seconds &middot; No. ${no} &middot; 1 min read</p>
<p style="margin:0;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-.01em;color:${T.ink}">${esc(l.subject)}</p></td></tr>
<tr><td style="padding:24px 28px 30px">${inner}</td></tr>`)}
</td></tr>
<tr><td style="padding:18px 8px 0;font-size:12.5px;line-height:1.6;color:${T.ink3};text-align:center">
${esc(i.why)}<br>${esc(CLUB.name)} &middot; ${esc(CLUB.university)}<br>
<a href="${site}" style="color:${T.ink3}">${site.replace(/^https?:\/\//, "")}</a> &middot; <a href="${i.unsubscribe}" style="color:${T.ink3}">Unsubscribe</a>
</td></tr></table></td></tr>`)}
</body></html>`;

  const lines = (t: { cmd: string; lines: Line[] }) => [`  $ ${t.cmd}`, ...t.lines.map(([d, s]) => `  ${d ? d + " " : ""}${s}`)].join("\n");
  const text = [
    `Git in 60 seconds, No. ${no}`, "", first ? `Hey ${first},` : "Hey,", "",
    ...(note ? ["From the team:", note, ""] : []),
    l.setup, "", lines(l.before), "", l.question, `Hint: ${l.hint}`, "",
    "Take 30 seconds. No cheating. Got your answer? Keep reading.", "", "", "", "",
    "THE PROBLEM", l.problem.title, l.problem.text, "",
    "THE FIX", ...l.steps.map((s, n) => `${n + 1}. ${s.title}: ${s.note}`), "", lines(l.after), "",
    `GIT HABIT: ${l.habit.title}. ${l.habit.text}`, "", `IN ONE LINE: ${l.summary}`, "",
    l.poll.question, `${l.poll.yes}: ${vote("yes")}`, `${l.poll.no}: ${vote("no")}`, "",
    ...(i.agenda?.items.length ? [`${i.agenda.lead.toUpperCase()} AT THE CLUB`, ...i.agenda.items.map((e) => `${e.when}: ${e.title}${e.where ? `, ${e.where}` : ""} ${e.url}`), ""] : []),
    "See you next week,", "The GitHub Community Club team", "", i.why, `${CLUB.name} · ${site}`, `Unsubscribe: ${i.unsubscribe}`,
  ].join("\n");
  return { subject: l.subject, html, text };
}
