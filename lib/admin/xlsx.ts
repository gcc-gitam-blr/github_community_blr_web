/* Reads the first sheet of an Excel file (.xlsx) into rows of text, in the browser, with no library. An .xlsx file is a zip
   of XML files: the zip's central directory says where each file is, entries are stored or deflated (unpacked with the
   browser's own DecompressionStream), and the sheet's cells point into a shared list of strings. Formulas give their last
   value; dates arrive as Excel's day numbers (members.ts turns them into dates). Nothing leaves the browser. */

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The files in a zip, by name: each read only when asked for. */
export async function unzip(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const b = new Uint8Array(buf), files = new Map<string, () => Promise<string>>();
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65_535); i--) if (u32(b, i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("not a zip");
  const count = u16(b, end + 10);
  let p = u32(b, end + 16);
  const text = new TextDecoder();
  for (let n = 0; n < count && u32(b, p) === 0x02014b50; n++) {
    const method = u16(b, p + 10), size = u32(b, p + 20), nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), commentLen = u16(b, p + 32), local = u32(b, p + 42);
    const name = text.decode(b.subarray(p + 46, p + 46 + nameLen));
    files.set(name, async () => {
      const start = local + 30 + u16(b, local + 26) + u16(b, local + 28), raw = b.subarray(start, start + size);
      if (method === 0) return text.decode(raw);
      if (method === 8) return text.decode(await inflate(raw));
      throw new Error("unsupported compression");
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unescape = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ({ amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" } as Record<string, string>)[e.toLowerCase()]);
/** All the text runs inside one piece of XML (a shared string can be split into styled runs). */
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join("");
/** "C7" → column 2 (counting from 0). */
const colOf = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+$/, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf);
  const read = async (name: string) => (await files.get(name)?.()) ?? null;
  // the first sheet in the workbook's own order, wherever it is stored
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await read("xl/workbook.xml"), rels = await read("xl/_rels/workbook.xml.rels");
  const firstId = wb?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (firstId && rels) {
    const target = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstId}"`))?.[1];
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("no sheet");
  const shared = [...((await read("xl/sharedStrings.xml")) ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const rows: string[][] = [];
  for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const out: string[] = [];
    for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], body = c[2] ?? "", ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1], type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const value = type === "s" ? shared[Number(v)] ?? "" : type === "inlineStr" ? texts(body) : unescape(v ?? "");
      out[ref ? colOf(ref) : out.length] = value;
    }
    rows.push(Array.from(out, (x) => x ?? ""));
  }
  return rows;
}
