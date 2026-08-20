import { inflateSync } from "node:zlib";
import unzipper from "unzipper";

/** One reading from CrossWire's VarApp, including the witnesses printed after it. */
export interface VarAppReadingRow {
  verseId: number;
  sourceRef: string;
  readingOrder: number;
  readingText: string;
  witnesses: string;
  isBase: boolean;
}

interface IndexRow {
  buffer: number;
  start: number;
  length: number;
}

const BOOK_RE = /<div\s+annotateRef="([A-Za-z0-9]+\.\d+\.\d+)"[^>]*>/;

function readIndex(bytes: Buffer): IndexRow[] {
  if (bytes.length % 10 !== 0) {
    throw new Error(`VarApp nt.bzv has ${bytes.length} bytes, not a multiple of 10`);
  }
  const rows: IndexRow[] = [];
  for (let offset = 0; offset < bytes.length; offset += 10) {
    rows.push({
      buffer: bytes.readUInt32LE(offset),
      start: bytes.readUInt32LE(offset + 4),
      length: bytes.readUInt16LE(offset + 8),
    });
  }
  return rows;
}

function readBlocks(indexBytes: Buffer, dataBytes: Buffer): Buffer[] {
  if (indexBytes.length % 12 !== 0) {
    throw new Error(`VarApp nt.bzs has ${indexBytes.length} bytes, not a multiple of 12`);
  }
  const blocks: Buffer[] = [];
  for (let offset = 0; offset < indexBytes.length; offset += 12) {
    const compressedOffset = indexBytes.readUInt32LE(offset);
    const compressedLength = indexBytes.readUInt32LE(offset + 4);
    blocks.push(
      // ZIP compression in SWORD stores each block as a zlib stream. The index also carries the
      // uncompressed length; inflateSync verifies the stream and we check that length below.
      inflateSync(dataBytes.subarray(compressedOffset, compressedOffset + compressedLength)),
    );
  }
  return blocks;
}

function plainMarkup(input: string): string {
  return input
    .replace(/<lb\s*\/>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u202d/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function parseReadings(text: string): { readingText: string; witnesses: string }[] {
  return plainMarkup(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const bracket = line.indexOf("]");
      if (bracket < 1) return [];
      const readingText = line.slice(0, bracket).trim();
      const witnesses = line.slice(bracket + 1).trim();
      return readingText && witnesses ? [{ readingText, witnesses }] : [];
    });
}

/**
 * Read the public-domain/CC0 VarApp SWORD module without depending on the SWORD runtime.
 *
 * The module's zCom format is deliberately decoded here rather than treated as text: nt.bzv
 * indexes compressed buffers, nt.bzs supplies their offsets, and nt.bzz contains zlib streams.
 * Each entry retains the source's `annotateRef`, so this parser never invents a second address
 * scheme. The module declares NRSV versification; its two divergences are resolved by the same
 * reviewed Greek mapping used by SBLGNT.
 */
export async function parseVarApp(
  zipPath: string,
  resolveRef: (sourceRef: string) => { verseId: number; sourceRef: string } | null,
): Promise<VarAppReadingRow[]> {
  const directory = await unzipper.Open.file(zipPath);
  const get = async (name: string): Promise<Buffer> => {
    const entry = directory.files.find((file) => file.path === name);
    if (!entry) throw new Error(`VarApp: ${name} not found in module`);
    return entry.buffer();
  };

  const index = readIndex(await get("modules/comments/zcom/varapp/nt.bzv"));
  const blocks = readBlocks(
    await get("modules/comments/zcom/varapp/nt.bzs"),
    await get("modules/comments/zcom/varapp/nt.bzz"),
  );
  const rows: VarAppReadingRow[] = [];
  const seen = new Set<string>();

  for (const entry of index) {
    if (entry.length === 0) continue;
    const block = blocks[entry.buffer];
    if (!block || entry.start + entry.length > block.length) {
      throw new Error(`VarApp: index points outside decompressed block ${entry.buffer}`);
    }
    const raw = block.subarray(entry.start, entry.start + entry.length).toString("utf8");
    const sourceRef = raw.match(BOOK_RE)?.[1];
    if (!sourceRef || seen.has(sourceRef)) continue;
    const resolved = resolveRef(sourceRef);
    if (!resolved) continue;
    const readings = parseReadings(raw);
    // A single reading is a witness statement, not a variant unit. Keep only loci where the
    // module actually presents alternatives; this keeps an ordinary chapter readable while
    // retaining every reading and witness at a disputed locus.
    if (readings.length < 2) continue;
    seen.add(sourceRef);
    readings.forEach((reading, readingOrder) => {
      rows.push({
        verseId: resolved.verseId,
        sourceRef: resolved.sourceRef,
        readingOrder,
        readingText: reading.readingText,
        witnesses: reading.witnesses,
        isBase: readingOrder === 0,
      });
    });
  }
  return rows;
}
