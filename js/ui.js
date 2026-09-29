/* Small UI behaviours: nav state, mobile menu, reveal-on-scroll, counters,
   cursor spotlight on cards, timeline progress. */
(function (GC) {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function nav() {
    const bar = $("#nav"), links = $("#navLinks"), burger = $("#burger");
    const onScroll = () => bar.classList.toggle("scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const setOpen = (open) => {
      links.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    burger.addEventListener("click", () => setOpen(!links.classList.contains("open")));
    links.addEventListener("click", (e) => e.target.closest("a") && setOpen(false));
    document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));

    // highlight the link of the section currently in view
    const map = new Map($$("a", links).map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const a = map.get(e.target.id);
      if (a && e.isIntersecting) { map.forEach((x) => x.classList.remove("active")); a.classList.add("active"); }
    }), { rootMargin: "-45% 0px -50% 0px" });
    map.forEach((_, id) => { const s = document.getElementById(id); s && io.observe(s); });
  }

  function reveal(root = document) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    $$(".reveal:not(.in)", root).forEach((n) => io.observe(n));
  }

  function counters() {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const end = +e.target.dataset.to, suffix = e.target.dataset.suffix || "";
      const t0 = performance.now(), dur = 1600;
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 4);
        e.target.textContent = Math.round(end * eased).toLocaleString("en-IN") + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: 0.6 });
    $$("[data-to]").forEach((n) => io.observe(n));
  }

  function spotlight(root = document) {
    $$(".track", root).forEach((c) => c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
    }));
  }

  /* The timeline's black line fills as you scroll through it. */
  function timelineProgress() {
    const tl = $("#timeline");
    if (!tl) return;
    const update = () => {
      const r = tl.getBoundingClientRect(), vh = window.innerHeight;
      const p = (vh * 0.6 - r.top) / r.height;
      tl.style.setProperty("--p", Math.max(0, Math.min(1, p)).toFixed(3));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  GC.ui = { nav, reveal, counters, spotlight, timelineProgress };
})((window.GC = window.GC || {}));
