/* Git-graph renderer — the visual signature of the site.
   Draws lanes, curved branch/merge edges and shaped commit nodes as SVG,
   then animates edges drawing in and nodes popping, row by row. */
(function (GC) {
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = { blue: "#b9e0f7", purple: "#b48be6", mint: "#4fd1a1", green: "#3fc84e", white: "#ffffff" };

  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  /* The glyph inside a node: diamond / square / ring / triangle. */
  function glyph(parent, shape, cx, cy, s = 1) {
    const stroke = { stroke: "#0b0b0f", "stroke-width": 3.5 * s, "stroke-linejoin": "round" };
    switch (shape) {
      case "diamond": return el("rect", { x: cx - 8 * s, y: cy - 8 * s, width: 16 * s, height: 16 * s, fill: "none", transform: `rotate(45 ${cx} ${cy})`, ...stroke }, parent);
      case "square": return el("rect", { x: cx - 8 * s, y: cy - 8 * s, width: 16 * s, height: 16 * s, fill: "none", ...stroke }, parent);
      case "ring": return el("circle", { cx, cy, r: 7 * s, fill: "#fff", ...stroke }, parent);
      case "triangle": return el("path", { d: `M${cx} ${cy - 9 * s} L${cx + 9 * s} ${cy + 7 * s} L${cx - 9 * s} ${cy + 7 * s} Z`, fill: "none", ...stroke }, parent);
    }
  }

  /* A standalone node as an <svg> — used for markers in cards & timelines. */
  function nodeSVG(shape, color, size = 44) {
    const svg = el("svg", { viewBox: "0 0 44 44", width: size, height: size, "aria-hidden": "true" });
    el("circle", { cx: 22, cy: 22, r: 19.5, fill: COLORS[color] || color, stroke: "#0b0b0f", "stroke-width": 3.5 }, svg);
    glyph(svg, shape, 22, 22, 0.85);
    return svg;
  }

  /* Edge path between two nodes. Straight if same lane, otherwise a rounded
     'S' — leave the parent vertically, turn horizontally, drop into the child. */
  function edgePath(a, b, r) {
    if (a.x === b.x) return `M${a.x} ${a.y} V${b.y}`;
    const s = Math.sign(b.x - a.x);
    const merge = b.merge === true;
    const ym = merge ? b.y - (b.y - a.y) * 0.5 : a.y + (b.y - a.y) * 0.5;
    return `M${a.x} ${a.y} V${ym - r} Q${a.x} ${ym} ${a.x + s * r} ${ym} H${b.x - s * r} Q${b.x} ${ym} ${b.x} ${ym + r} V${b.y}`;
  }

  /*  spec = { nodes:[{id,lane,row,shape,color,label}], edges:[[fromId,toId]],
               dx, dy, pad, r }                                                 */
  function draw(svg, spec) {
    const dx = spec.dx || 82, dy = spec.dy || 100, pad = spec.pad || 44, R = 22;
    const pos = {};
    spec.nodes.forEach((n) => (pos[n.id] = { ...n, x: pad + n.lane * dx, y: pad + n.row * dy }));
    const maxLane = Math.max(...spec.nodes.map((n) => n.lane));
    const maxRow = Math.max(...spec.nodes.map((n) => n.row));
    const w = pad * 2 + maxLane * dx, h = pad * 2 + maxRow * dy;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = "";

    const ghost = el("g", { fill: "none", stroke: "#e4e8e6", "stroke-width": 4, "stroke-linecap": "round" }, svg);
    const edges = el("g", { fill: "none", stroke: "#0b0b0f", "stroke-width": 4, "stroke-linecap": "round" }, svg);
    spec.edges.forEach(([f, t], i) => {
      const a = pos[f], b = pos[t];
      const d = edgePath(a, b, 24);
      el("path", { d }, ghost);
      const p = el("path", { d, pathLength: 1, class: "g-edge" }, edges);
      p.style.setProperty("--i", Math.min(a.row, b.row));
    });

    const nodes = el("g", {}, svg);
    spec.nodes.forEach((n) => {
      const p = pos[n.id];
      const g = el("g", { class: "g-node", transform: `translate(${p.x} ${p.y})`, tabindex: 0 }, nodes);
      g.style.setProperty("--i", n.row);
      const inner = el("g", { class: "g-node__in" }, g);
      el("circle", { r: R, fill: COLORS[n.color] || n.color, stroke: "#0b0b0f", "stroke-width": 4 }, inner);
      glyph(inner, n.shape, 0, 0, 1);
      if (n.label) el("title", {}, g).textContent = n.label;
    });
    return svg;
  }

  /* Trigger the draw-in when the graph scrolls into view. */
  function animateOnView(svg) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { svg.classList.add("in"); io.disconnect(); }
    }), { threshold: 0.15 });
    io.observe(svg);
  }

  GC.graph = { draw, nodeSVG, animateOnView, COLORS };
})((window.GC = window.GC || {}));
