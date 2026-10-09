/**
 * Does Brenton's Septuagint use the canonical chapter/verse labels for books 1-5?
 *
 * Usage (from packages/ingest):
 *   node --import tsx scripts/check-brenton-identity.ts <eng-Brenton_usfx.zip> <bible.db> [book ids, default 1,2,3,4,5]
 *
 * Per chapter it reports:
 *   extra    Brenton labels with no canonical verse
 *   missing  canonical verses Brenton does not label
 *   shifted  labels present in both whose Brenton text matches a DIFFERENT KJV verse of the
 *            same book clearly better than the same-labelled one. Labels alone cannot see the
 *            Septuagint's reordering of Exodus 36-39: the labels exist, the content moved.
 * A chapter is `identity` only when all three are empty; a book only when every chapter is.
 *
 * With --mapped, Brenton labels are first passed through the reviewed `verseOffsets` and the
 * `unplacedSourceVerses` are dropped, so the report shows what the map leaves unexplained.
 */
import Database from "better-sqlite3";
import { isUnplacedSourceVerse, mapSourceVerse, TRANSLATION_SOURCES } from "../src/translations.ts";
import { parseUsfx } from "../src/usfx.ts";

const args = process.argv.slice(2);
const mapped = args.includes("--mapped");
const [zipPath, dbPath, bookArg] = args.filter((a) => a !== "--mapped");
if (!zipPath || !dbPath) throw new Error("usage: check-brenton-identity.ts <brenton usfx zip> <bible.db>");

const BOOKS = (bookArg ?? "1,2,3,4,5").split(",").map(Number);
const STOP = new Set(
  "the and that unto with shall them they their thee thou thy which have from this were will upon also there when then said shalt hath these into before your what them unto every said".split(" "),
);
const words = (s: string) =>
  new Set(s.toLowerCase().match(/\p{L}{4,}/gu)?.filter((w) => !STOP.has(w)) ?? []);
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / (a.size + b.size - n);
};

const db = new Database(dbPath, { readonly: true });
const canonical = db
  .prepare(
    `SELECT v.osis_ref AS osis, v.book_id AS b, v.chapter AS c, v.verse AS v, t.text AS text
     FROM verses v LEFT JOIN verse_texts t ON t.verse_id = v.verse_id
       AND t.translation_id = (SELECT translation_id FROM translations WHERE code = 'KJV')
     WHERE v.book_id IN (${BOOKS.join(",")})`,
  )
  .all() as { osis: string; b: number; c: number; v: number; text: string | null }[];
const lxx = TRANSLATION_SOURCES.find((t) => t.code === "LXX")!;
const brenton = (await parseUsfx(zipPath, { allowVerseSuffix: true })).verses
  .filter((v) => BOOKS.includes(v.bookId))
  .filter((v) => !mapped || !isUnplacedSourceVerse(lxx, v.bookId, v.chapter, v.verse))
  .map((v) => (mapped ? { ...v, ...mapSourceVerse(lxx, v.bookId, v.chapter, v.verse) } : v));

const key = (b: number, c: number, v: number) => `${b}.${c}.${v}`;
let failed = 0;
for (const book of BOOKS) {
  const canon = canonical.filter((r) => r.b === book);
  const kjv = new Map(canon.map((r) => [key(r.b, r.c, r.v), words(r.text ?? "")]));
  const src = new Map(brenton.filter((v) => v.bookId === book).map((v) => [key(v.bookId, v.chapter, v.verse), v]));
  const chapters = [...new Set([...canon.map((r) => r.c), ...[...src.values()].map((v) => v.chapter)])].sort((a, b) => a - b);
  let bad = 0;
  console.log(`${canon[0]?.osis.split(".")[0]} (book ${book})`);
  for (const c of chapters) {
    const extra = [...src.values()].filter((v) => v.chapter === c && !kjv.has(key(book, c, v.verse))).map((v) => v.verse);
    const missing = canon.filter((r) => r.c === c && !src.has(key(book, c, r.v))).map((r) => r.v);
    const shifted: string[] = [];
    for (const v of src.values()) {
      if (v.chapter !== c) continue;
      const own = kjv.get(key(book, c, v.verse));
      if (!own) continue;
      const bw = words(v.text);
      const same = jaccard(bw, own);
      let best = same;
      let bestKey = "";
      for (const [k, w] of kjv) {
        const s = jaccard(bw, w);
        if (s > best) [best, bestKey] = [s, k];
      }
      if (bestKey && best >= 0.3 && best - same >= 0.15) shifted.push(`${v.verse}->${bestKey.split(".").slice(1).join(":")}`);
    }
    const ok = extra.length + missing.length + shifted.length === 0;
    if (!ok) {
      bad++;
      const parts = [
        extra.length && `extra ${extra.join(",")}`,
        missing.length && `missing ${missing.join(",")}`,
        shifted.length && `shifted ${shifted.join(" ")}`,
      ].filter(Boolean);
      console.log(`  ch ${c}: ${parts.join("; ")}`);
    }
  }
  console.log(`  => ${bad === 0 ? "IDENTITY" : `NOT identity (${bad} of ${chapters.length} chapters)`}; ${src.size} Brenton verses, ${canon.length} canonical`);
  if (bad) failed++;
}
console.log(`${BOOKS.length - failed} of ${BOOKS.length} books identity`);
