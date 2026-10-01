"use client";
import { useEffect, useRef, useState } from "react";
import type { NodeColor, Shape } from "@/lib/config";

export const NODE_COLORS: Record<NodeColor | "white", string> = { blue: "#b9e0f7", purple: "#b48be6", mint: "#4fd1a1", green: "#3fc84e", white: "#ffffff" };

const S = { stroke: "#0b0b0f", strokeLinejoin: "round" as const };

/** The glyph inside a node: diamond / square / ring / triangle. */
function Glyph({ shape, s = 1 }: { shape: Shape; s?: number }) {
  const sw = 3.5 * s;
  switch (shape) {
    case "diamond": return <rect x={-8 * s} y={-8 * s} width={16 * s} height={16 * s} fill="none" strokeWidth={sw} transform="rotate(45)" {...S} />;
    case "square": return <rect x={-8 * s} y={-8 * s} width={16 * s} height={16 * s} fill="none" strokeWidth={sw} {...S} />;
    case "ring": return <circle r={7 * s} fill="#fff" strokeWidth={sw} {...S} />;
    case "triangle": return <path d={`M0 ${-9 * s}L${9 * s} ${7 * s}L${-9 * s} ${7 * s}Z`} fill="none" strokeWidth={sw} {...S} />;
  }
}

/** Standalone node badge, used in cards and timelines. */
export function NodeIcon({ shape, color, size = 44 }: { shape: Shape; color: NodeColor; size?: number }) {
  return (
    <svg viewBox="-22 -22 44 44" width={size} height={size} aria-hidden="true">
      <circle r={19.5} fill={NODE_COLORS[color]} stroke="#0b0b0f" strokeWidth={3.5} />
      <Glyph shape={shape} s={0.85} />
    </svg>
  );
}

export interface GNode { id: string; lane: number; row: number; shape: Shape; color: NodeColor; label?: string }

/** Rounded 'S' edge: leave the parent vertically, turn, drop into the child. */
function edgePath(a: { x: number; y: number }, b: { x: number; y: number }, r = 24) {
  if (a.x === b.x) return `M${a.x} ${a.y} V${b.y}`;
  const s = Math.sign(b.x - a.x), ym = a.y + (b.y - a.y) / 2;
  return `M${a.x} ${a.y} V${ym - r} Q${a.x} ${ym} ${a.x + s * r} ${ym} H${b.x - s * r} Q${b.x} ${ym} ${b.x} ${ym + r} V${b.y}`;
}

export function GitGraph({ nodes, edges, dx = 82, dy = 100, pad = 44, className = "", decorative = false }: { nodes: GNode[]; edges: [string, string][]; dx?: number; dy?: number; pad?: number; className?: string; decorative?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el); return () => io.disconnect();
  }, []);

  const pos = Object.fromEntries(nodes.map((n) => [n.id, { ...n, x: pad + n.lane * dx, y: pad + n.row * dy }]));
  const w = pad * 2 + Math.max(...nodes.map((n) => n.lane)) * dx, h = pad * 2 + Math.max(...nodes.map((n) => n.row)) * dy;
  const paths = edges.map(([f, t]) => ({ d: edgePath(pos[f], pos[t]), i: Math.min(pos[f].row, pos[t].row) }));

  return (
    <svg ref={ref} viewBox={`0 0 ${w} ${h}`} className={`graph overflow-visible ${seen ? "in" : ""} ${className}`} role="img" aria-label="Animated git branch graph">
      <g fill="none" stroke="#e4e8e6" strokeWidth={4} strokeLinecap="round">{paths.map((p, k) => <path key={k} d={p.d} />)}</g>
      <g fill="none" stroke="#0b0b0f" strokeWidth={4} strokeLinecap="round">
        {paths.map((p, k) => <path key={k} d={p.d} pathLength={1} className="g-edge" style={{ "--i": p.i } as React.CSSProperties} />)}
      </g>
      {nodes.map((n) => (
        <g key={n.id} className="g-node" transform={`translate(${pos[n.id].x} ${pos[n.id].y})`} style={{ "--i": n.row } as React.CSSProperties} tabIndex={decorative ? undefined : 0}>
          <g className="g-node__in">
            <circle r={22} fill={NODE_COLORS[n.color]} stroke="#0b0b0f" strokeWidth={4} />
            <Glyph shape={n.shape} />
          </g>
          {n.label && <title>{n.label}</title>}
        </g>
      ))}
    </svg>
  );
}
