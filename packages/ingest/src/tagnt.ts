import { readFile } from "node:fs/promises";

/** A translation-relevant Greek edition difference from STEPBible's TAGNT. */
export interface TagntVariantRow {
  sourceRef: string;
  sourcePosition: number;
  baseSurface: string;
  baseEditions: string;
  alternateSurface: string | null;
  alternateEditions: string | null;
  note: string | null;
}

const LINE = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\{[^}]+\})?#(\d+)=([^\t]+)\t/;
const ALL_EDITIONS = new Set(["NA28", "NA27", "Tyn", "SBL", "WH", "Treg", "TR", "Byz"]);

function editions(value: string): Set<string> {
  return new Set(value.split("+").map((part) => part.trim()).filter(Boolean));
}

function alternate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // TAGNT notes use `reading (transliteration) meaning - ...`; keep the reading and discard
  // the explanatory gloss. The full source note remains alongside it for auditability.
  return trimmed.split(/\s+in:\s+/i)[0].replace(/\s+-\s+[^-]+$/, "").trim().split(/\s+\(/)[0] || null;
}

function GreekSurface(value: string): string {
  return value.trim().split(/\s+\(/)[0] ?? value.trim();
}

/** Parse one or more TAGNT TSV files. The input is deliberately line-oriented: the 30MB files
 * are build inputs, not runtime data, and streaming them avoids a second large allocation. */
export async function parseTagntFiles(
  files: readonly string[],
  bookIdByTag: ReadonlyMap<string, number>,
  canonicalVerseId: (bookId: number, chapter: number, verse: number) => number | null,
): Promise<TagntVariantRow[]> {
  const rows: TagntVariantRow[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const line of text.split("\n")) {
      const match = LINE.exec(line);
      if (!match) continue;
      const [, book, chapter, verse, position, baseAndLabel] = match;
      const fields = line.replace(/^\uFEFF/, "").split("\t");
      const baseSurface = GreekSurface(fields[1] ?? "");
      const baseEditions = fields[5]?.trim() ?? "";
      const editionSet = editions(baseEditions);
      const alt = alternate(fields[6] ?? "");
      const note = [fields[7], fields[12], fields[13], fields[14]].filter(Boolean).join(" ").trim() || null;
      const differs = editionSet.size > 0 &&
        (editionSet.size !== ALL_EDITIONS.size || [...ALL_EDITIONS].some((e) => !editionSet.has(e)) || alt || note);
      if (!differs || !baseSurface) continue;
      const bookId = bookIdByTag.get(book);
      if (bookId === undefined || canonicalVerseId(bookId, Number(chapter), Number(verse)) === null) continue;
      rows.push({
        sourceRef: `${book}.${chapter}.${verse}`,
        sourcePosition: Number(position),
        baseSurface,
        baseEditions,
        alternateSurface: alt,
        alternateEditions: alt ? (fields[6]?.match(/\bin:\s*(.*)$/i)?.[1] ?? null) : null,
        note: note ?? (baseAndLabel.includes("=") ? baseAndLabel.split("=")[1] : null),
      });
    }
  }
  return rows;
}
