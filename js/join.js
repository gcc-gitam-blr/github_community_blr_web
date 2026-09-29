/* Join form — validates the GitHub handle live against the GitHub API,
   lights up the commit-line dots as each step is completed, and submits
   to a form endpoint (or falls back to a pre-filled email). */
(function (GC) {
  const C = GC.CONFIG;

  GC.initJoin = function () {
    const form = document.getElementById("join");
    const hint = document.getElementById("joinHint");
    const fields = [...form.querySelectorAll(".field")];
    const handle = form.elements.handle, email = form.elements.email, track = form.elements.track;
    const avatar = form.querySelector(".field__avatar");
    let handleOk = false, timer;

    const say = (msg, kind = "") => { hint.textContent = msg; hint.className = "join-card__hint " + kind; };
    const setOk = (input, ok) => { input.closest(".field").classList.toggle("ok", ok); progress(); };
    const progress = () => {
      const n = fields.filter((f) => f.classList.contains("ok")).length;
      form.querySelector(".join-card__fields").style.setProperty("--fill", `${Math.max(0, (n - 1) / (fields.length - 1)) * 100}%`);
    };

    handle.addEventListener("input", () => {
      clearTimeout(timer);
      handleOk = false; avatar.hidden = true; setOk(handle, false);
      const v = handle.value.trim().replace(/^@/, "");
      if (!v) return say("No password needed — we only need to know who to welcome.");
      if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(v)) return say("That doesn't look like a GitHub username.", "bad");
      say("Looking you up on GitHub…");
      timer = setTimeout(async () => {
        try {
          const res = await fetch(`https://api.github.com/users/${encodeURIComponent(v)}`);
          if (res.status === 404) return say("No GitHub user with that name — check the spelling?", "bad");
          if (!res.ok) throw new Error();
          const u = await res.json();
          avatar.src = u.avatar_url + "&s=60"; avatar.hidden = false;
          handleOk = true; setOk(handle, true);
          say(`Found you, ${u.name || u.login}! ✓`, "good");
        } catch { // rate-limited / offline: accept the format check alone
          handleOk = true; setOk(handle, true); say("Couldn't reach GitHub, but that format looks good.");
        }
      }, 450);
    });

    email.addEventListener("input", () => setOk(email, email.validity.valid && !!email.value));
    track.addEventListener("change", () => setOk(track, !!track.value));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const bad = [[handle, handleOk], [email, email.validity.valid && !!email.value], [track, !!track.value]].filter(([, ok]) => !ok);
      if (bad.length) {
        bad.forEach(([i]) => { const f = i.closest(".field"); f.classList.remove("err"); void f.offsetWidth; f.classList.add("err"); });
        bad[0][0].focus();
        return say("Almost there — complete all three steps first.", "bad");
      }
      const payload = { handle: handle.value.trim().replace(/^@/, ""), email: email.value.trim(), track: track.options[track.selectedIndex].text };
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Merging…";
      try {
        if (C.formEndpoint) {
          const res = await fetch(C.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
          if (!res.ok) throw new Error();
        } else {
          const body = `Hi! I'd like to join.%0D%0A%0D%0AGitHub: @${payload.handle}%0D%0AEmail: ${payload.email}%0D%0ATrack: ${payload.track}`;
          window.location.href = `mailto:${C.email}?subject=${encodeURIComponent("Join GitHub Community Club BLR")}&body=${body}`;
        }
        btn.textContent = "Welcome aboard ✓"; say(`Pull request merged. Welcome, @${payload.handle}!`, "good");
        celebrate(btn);
      } catch {
        btn.disabled = false; btn.textContent = "Join the club";
        say("Something went wrong — please try again.", "bad");
      }
    });
  };

  /* tiny confetti burst made of git-graph shapes */
  function celebrate(origin) {
    const r = origin.getBoundingClientRect(), shapes = ["diamond", "square", "ring", "triangle"], colors = ["blue", "purple", "mint", "green"];
    for (let i = 0; i < 26; i++) {
      const n = GC.graph.nodeSVG(shapes[i % 4], colors[i % 4], 20 + Math.random() * 14);
      Object.assign(n.style, { position: "fixed", left: r.left + r.width / 2 + "px", top: r.top + "px", zIndex: 99, pointerEvents: "none" });
      document.body.appendChild(n);
      const a = Math.random() * Math.PI - Math.PI, d = 120 + Math.random() * 260;
      n.animate([{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 220}px) rotate(${Math.random() * 540}deg)`, opacity: 0 }],
        { duration: 1200 + Math.random() * 600, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => n.remove();
    }
  }
})((window.GC = window.GC || {}));
