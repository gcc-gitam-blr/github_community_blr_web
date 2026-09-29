/* Renders every data-driven section from GC.CONFIG. */
(function (GC) {
  const C = GC.CONFIG;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(7, "0").slice(0, 7); };

  function heroGraph() {
    const svg = $("#heroGraph");
    GC.graph.draw(svg, {
      dx: 82, dy: 100, pad: 44,
      nodes: [
        { id: "a", lane: 1, row: 0, shape: "diamond", color: "blue", label: "main · first workshop" },
        { id: "b", lane: 1, row: 1, shape: "square", color: "blue", label: "main · hack night" },
        { id: "c", lane: 2, row: 1, shape: "ring", color: "purple", label: "feat/open-source · first PR" },
        { id: "d", lane: 1, row: 2, shape: "diamond", color: "blue", label: "main · 100 members" },
        { id: "e", lane: 2, row: 2, shape: "ring", color: "purple", label: "feat/open-source · merged" },
        { id: "f", lane: 0, row: 3, shape: "triangle", color: "mint", label: "feat/ai · copilot lab" },
        { id: "g", lane: 1, row: 3, shape: "square", color: "blue", label: "main · hackathon" },
        { id: "h", lane: 0, row: 4, shape: "triangle", color: "mint", label: "feat/ai · shipped" },
      ],
      edges: [["a", "b"], ["a", "c"], ["b", "d"], ["c", "e"], ["d", "f"], ["d", "g"], ["f", "h"]],
    });
    GC.graph.animateOnView(svg);
  }

  function marquee() {
    const words = ["git init", "git commit -m \"ship it\"", "pull requests welcome", "open source", "hackathons", "workshops", "code review", "git push origin main", "good first issue", "merge conflicts resolved together"];
    const row = words.map((w) => `<span>${esc(w)}</span>`).join("");
    $("#marquee").innerHTML = row + row; // duplicated for a seamless loop
  }

  function stats() {
    $("#stats").innerHTML = C.stats.map((s, i) =>
      `<li class="stat reveal" style="--d:${i * 0.08}s"><b data-to="${s.value}" data-suffix="${esc(s.suffix)}">0</b><span>${esc(s.label)}</span></li>`).join("");
  }

  function tracks() {
    const ul = $("#tracksGrid");
    ul.innerHTML = C.tracks.map((t, i) => `<li class="track reveal" style="--d:${(i % 3) * 0.1}s"><span class="track__no">${String(i + 1).padStart(2, "0")}</span><span class="track__node" data-node="${t.shape}|${t.color}"></span><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p></li>`).join("");
    ul.querySelectorAll("[data-node]").forEach((n) => { const [s, c] = n.dataset.node.split("|"); n.appendChild(GC.graph.nodeSVG(s, c, 52)); });
    const sel = document.querySelector('select[name="track"]');
    C.tracks.forEach((t) => sel.add(new Option(t.title, t.id)));
  }

  function events() {
    const today = new Date().toISOString().slice(0, 10);
    const list = [...C.events].sort((a, b) => a.date.localeCompare(b.date));
    const ol = $("#timeline");
    ol.innerHTML = list.map((e, i) => `
      <li class="tl reveal${e.date < today ? " past" : ""}" style="--d:${i * 0.06}s">
        <span class="tl__node" data-node="${e.shape}|${e.color}"></span>
        <article class="tl__card">
          <div class="tl__meta"><span class="tl__hash">${hash(e.title + e.date)}</span><span>${fmtDate(e.date)}</span><span class="tl__type">${esc(e.type)}</span></div>
          <h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>
          <p class="tl__where">📍 ${esc(e.where)}</p>
        </article>
      </li>`).join("");
    ol.querySelectorAll("[data-node]").forEach((n) => { const [s, c] = n.dataset.node.split("|"); n.appendChild(GC.graph.nodeSVG(s, c, 44)); });
  }

  const repoCard = (r) => `<li class="repo reveal"><a href="${esc(r.html_url)}" target="_blank" rel="noopener" style="display:contents">
      <h3>${esc(r.name)}</h3><p>${esc(r.description || "No description yet — be the first to write one.")}</p>
      <div class="repo__meta">${r.language ? `<span class="repo__lang">${esc(r.language)}</span>` : ""}<span>★ ${r.stargazers_count || 0}</span></div></a></li>`;

  async function repos() {
    const ul = $("#repos");
    ul.innerHTML = '<li class="repo skeleton"></li>'.repeat(3);
    let data = C.sampleRepos;
    if (C.githubOrg) {
      try {
        const res = await fetch(`https://api.github.com/orgs/${encodeURIComponent(C.githubOrg)}/repos?sort=updated&per_page=6`);
        if (res.ok) { const j = await res.json(); if (j.length) data = j; }
      } catch { /* offline or rate-limited — fall back to samples */ }
    }
    ul.innerHTML = data.slice(0, 6).map(repoCard).join("");
    GC.ui.reveal(ul);
  }

  function team() {
    $("#teamGrid").innerHTML = C.team.map((m, i) => {
      const pic = m.handle
        ? `<img src="https://github.com/${encodeURIComponent(m.handle)}.png?size=400" alt="${esc(m.role)} @${esc(m.handle)}" loading="lazy">`
        : `<svg viewBox="0 0 40 40" fill="none" stroke="#0b0b0f" stroke-width="3" stroke-linecap="round"><circle cx="20" cy="14" r="7"/><path d="M6 36c1-8 7-12 14-12s13 4 14 12"/></svg>`;
      const h = m.handle ? `<a class="member__handle" href="https://github.com/${encodeURIComponent(m.handle)}" target="_blank" rel="noopener">@${esc(m.handle)}</a>` : `<span class="member__handle">@you-next?</span>`;
      return `<li class="member reveal" style="--d:${i * 0.08}s"><div class="member__pic">${pic}</div><h3>${esc(m.role)}</h3>${h}<p>${esc(m.note)}</p></li>`;
    }).join("");
  }

  function faq() {
    $("#faqList").innerHTML = C.faq.map((f) => `<details class="reveal"><summary>${esc(f.q)}<i></i></summary><p>${esc(f.a)}</p></details>`).join("");
  }

  function footer() {
    $("#footerLinks").innerHTML = C.socials.map((s) => `<li><a href="${esc(s.href)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a></li>`).join("");
    $("#year").textContent = new Date().getFullYear();
    document.querySelectorAll("[data-github]").forEach((a) => (a.href = C.githubOrg ? `${C.githubUrl}/${C.githubOrg}` : C.githubUrl));
  }

  GC.render = () => { heroGraph(); marquee(); stats(); tracks(); events(); repos(); team(); faq(); footer(); };
})((window.GC = window.GC || {}));
