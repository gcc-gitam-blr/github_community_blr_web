/* Interactive club shell. Boots with a fake `git log`, then takes commands. */
(function (GC) {
  const C = GC.CONFIG;

  GC.initTerminal = function () {
    const body = document.getElementById("termBody");
    const form = document.getElementById("termForm");
    const input = document.getElementById("termInput");
    const history = []; let hi = 0;

    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const print = (html, cls = "") => { const p = document.createElement("p"); p.className = cls; p.innerHTML = html; body.appendChild(p); body.scrollTop = body.scrollHeight; };
    const h = (s) => `<span class="hash">${s}</span>`;

    const commands = {
      help: () => print(`Available commands:
  <span class="hl">about</span>     who we are
  <span class="hl">tracks</span>    the six branches you can join
  <span class="hl">events</span>    upcoming events
  <span class="hl">log</span>       our commit history
  <span class="hl">team</span>      the maintainers
  <span class="hl">join</span>      jump to the sign-up form
  <span class="hl">github</span>    open our GitHub
  <span class="hl">clear</span>     clean the screen`),
      about: () => print(`${C.name}\nStudents in Bengaluru who learn, build and merge together.\nWorkshops · hackathons · open source · zero gatekeeping.`),
      tracks: () => C.tracks.forEach((t) => print(`<span class="purple">◆</span> ${esc(t.title.padEnd(16))} <span class="dim">${esc(t.text.split(".")[0])}</span>`)),
      events: () => [...C.events].sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => print(`${h(e.date)}  ${esc(e.title)} <span class="dim">— ${esc(e.where)}</span>`)),
      log: () => {
        ["a3f9c21 (HEAD -> main) feat: club website goes live", "9be04d7 feat: 24h build sprint announced", "7c1d8aa fix: everyone's first merge conflict", "51e2b90 docs: add code of conduct", "0000001 init: the club is born"]
          .forEach((l) => print(`${h(l.slice(0, 7))} ${esc(l.slice(8))}`));
      },
      team: () => C.team.forEach((m) => print(`<span class="hl">${esc(m.role.padEnd(16))}</span> ${m.handle ? "@" + esc(m.handle) : '<span class="dim">open — could be you</span>'}`)),
      join: () => { print("Taking you to the sign-up form…", "hl"); document.getElementById("join").scrollIntoView({ behavior: "smooth", block: "center" }); },
      github: () => { print(`Opening <a href="${esc(C.githubUrl)}" target="_blank" rel="noopener">${esc(C.githubUrl)}</a> …`); window.open(C.githubUrl, "_blank", "noopener"); },
      clear: () => { body.innerHTML = ""; },
      "git status": () => print(`On branch <span class="hl">main</span>\nYour branch is up to date with 'origin/community'.\nnothing to commit, but plenty to build.`),
      "git push": () => print("Everything up-to-date. Now go make something worth pushing.", "dim"),
      "sudo join": () => commands.join(),
      whoami: () => print("a future contributor."),
      ls: () => print('<span class="purple">workshops/</span>  <span class="purple">hackathons/</span>  <span class="purple">open-source/</span>  README.md'),
    };

    // boot sequence
    const boot = ['<span class="dim">Welcome to the club shell. Type</span> <span class="hl">help</span> <span class="dim">to begin.</span>', ""];
    boot.forEach((b) => print(b));
    commands.log();
    print("");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = input.value.trim(); input.value = "";
      if (!raw) return;
      history.push(raw); hi = history.length;
      print(esc(raw), "cmd");
      const fn = commands[raw.toLowerCase()];
      if (fn) fn(); else print(`command not found: <span class="hl">${esc(raw)}</span> — try <span class="hl">help</span>`, "dim");
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" && history.length) { e.preventDefault(); hi = Math.max(0, hi - 1); input.value = history[hi]; }
      if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(history.length, hi + 1); input.value = history[hi] || ""; }
    });
    document.getElementById("term").addEventListener("click", (e) => { if (!window.getSelection().toString()) input.focus({ preventScroll: true }); });
  };
})((window.GC = window.GC || {}));
