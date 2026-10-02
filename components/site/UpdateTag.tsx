/* A post's label, coloured like GitHub issue labels. Unknown tags get the neutral one. */
const COLORS: Record<string, string> = {
  Events: "bg-[#ddf4ff] text-[#0550ae] border-[#54aeff66]",
  Workshop: "bg-[#dafbe1] text-[#116329] border-[#4ac26b66]",
  Epoch: "bg-[#fff8c5] text-[#7d4e00] border-[#d4a72c66]",
  Website: "bg-[#fbefff] text-[#6e40c9] border-[#c297ff66]",
};

export function UpdateTag({ tag }: { tag: string }) {
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${COLORS[tag] ?? "border-line bg-soft text-ink-2"}`}>{tag}</span>;
}
