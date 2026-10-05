/* Pieces both quiz screens share. The four answers wear the club's git-graph node shapes and colours,
   so a phone and the projector agree on "the purple square" even from the back of the room. */

export const TILES = [
  { shape: "diamond", color: "#b9e0f7", name: "blue diamond" },
  { shape: "square", color: "#b48be6", name: "purple square" },
  { shape: "ring", color: "#4fd1a1", name: "green ring" },
  { shape: "triangle", color: "#ffc933", name: "gold triangle" },
] as const;

export function Glyph({ i, className = "h-[1em] w-[1em]" }: { i: number; className?: string }) {
  const S = { stroke: "currentColor", strokeWidth: 3.2, fill: "none", strokeLinejoin: "round" as const };
  return (
    <svg viewBox="-12 -12 24 24" className={`shrink-0 ${className}`} aria-hidden>
      {i === 0 && <rect x={-6.5} y={-6.5} width={13} height={13} transform="rotate(45)" {...S} />}
      {i === 1 && <rect x={-7.5} y={-7.5} width={15} height={15} {...S} />}
      {i === 2 && <circle r={7.5} {...S} />}
      {i === 3 && <path d="M0 -8.5L9 7.5L-9 7.5Z" {...S} />}
    </svg>
  );
}

/** A row of commits, one per question: done, current (pulsing), still to come. */
export function Progress({ index, total, className = "" }: { index: number; total: number; className?: string }) {
  return (
    <div className={`flex items-center ${className}`} role="img" aria-label={`Question ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex flex-1 items-center last:flex-none">
          <span className={`block h-[0.9em] w-[0.9em] shrink-0 rounded-full border-[0.18em] ${i < index ? "border-[#b48be6] bg-[#b48be6]" : i === index ? "animate-pulse-ring border-[#3fc84e] bg-[#0b0b0f] motion-reduce:animate-none" : "border-white/25 bg-transparent"}`} />
          {i < total - 1 && <span className={`h-[0.18em] flex-1 ${i < index ? "bg-[#b48be6]" : "bg-white/15"}`} />}
        </div>
      ))}
    </div>
  );
}

export const fmt = (n: number) => n.toLocaleString("en-IN");

/** Question text with `backticks` shown as code, the way it's written in the quiz file. */
export function Rich({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/).map((part, i) => part.length > 2 && part.startsWith("`") && part.endsWith("`")
    ? <code key={i} className="rounded-[0.25em] bg-current/12 px-[0.25em] font-mono text-[0.9em] font-semibold">{part.slice(1, -1)}</code>
    : part)}</>;
}
