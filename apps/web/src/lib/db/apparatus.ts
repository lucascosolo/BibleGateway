import { cache } from "react";

import { getCorpus, prepared } from "./client";
import type { VerseId, VerseRange } from "@/lib/refs/verse-id";

/**
 * Textual-critical apparatus: what a translation does *not* print, and who does.
 *
 * Twelve New Testament verses are absent from the earliest Greek manuscripts. Translations
 * following the critical text (BSB, tracking NA28) omit them; translations following the
 * Byzantine tradition (WEB) print them. The source data expresses an omission as an empty
 * string, and the ingest refuses to store that — an empty verse renders as a silent gap,
 * which is the one outcome a reader cannot interpret and cannot distinguish from a bug.
 *
 * So the omission is recorded instead, and this module makes it renderable. A gap in the
 * verse numbers is not noise to be smoothed over: it is the single most legible piece of
 * textual criticism in the corpus, and it should be the thing that teaches a reader the
 * apparatus exists at all.
 */

export interface VerseOmission {
  verseId: VerseId;
  chapter: number;
  verse: number;
  reason: string;
  /** Historical context for the reading difference; no exact insertion year is claimed. */
  history: string;
  /** Translation codes loaded here that *do* print this verse, for a one-click comparison. */
  printedBy: { code: string; name: string; translationId: number }[];
}

/**
 * Omissions inside a range for one translation, keyed by verse_id.
 *
 * Returns a Map because the caller interleaves these with `getPassage` results by verse id;
 * a list would force an O(n·m) scan per verse in the reader's render path.
 */
export function getOmissions(range: VerseRange, translationId: number): Map<number, VerseOmission> {
  const rows = prepared(
    `SELECT o.verse_id AS verseId, v.chapter, v.verse, o.reason, o.history
     FROM verse_omissions o
     JOIN verses v ON v.verse_id = o.verse_id
     WHERE o.translation_id = ? AND o.verse_id BETWEEN ? AND ?
     ORDER BY o.verse_id`,
  ).all(translationId, range.start, range.end) as {
    verseId: VerseId;
    chapter: number;
    verse: number;
    reason: string;
    history: string;
  }[];

  if (rows.length === 0) return new Map();

  // Which loaded translations print each omitted verse. Scoped to the same range rather than
  // queried per verse, so a chapter with several omissions still costs one round trip.
  const printedRows = prepared(
    `SELECT vt.verse_id AS verseId, t.translation_id AS translationId, t.code, t.name
     FROM verse_texts vt
     JOIN translations t ON t.translation_id = vt.translation_id
     WHERE vt.translation_id != ? AND vt.verse_id BETWEEN ? AND ?
     ORDER BY t.translation_id`,
  ).all(translationId, range.start, range.end) as {
    verseId: number;
    translationId: number;
    code: string;
    name: string;
  }[];

  const printedByVerse = new Map<number, VerseOmission["printedBy"]>();
  for (const row of printedRows) {
    const list = printedByVerse.get(row.verseId) ?? [];
    list.push({ code: row.code, name: row.name, translationId: row.translationId });
    printedByVerse.set(row.verseId, list);
  }

  return new Map(
    rows.map((row) => [
      row.verseId as number,
      { ...row, printedBy: printedByVerse.get(row.verseId) ?? [] },
    ]),
  );
}

/** Total omissions recorded per translation. Used by the corpus-facts surfaces. */
export function countOmissionsByTranslation(): { code: string; name: string; count: number }[] {
  return getCorpus()
    .prepare(
      `SELECT t.code, t.name, COUNT(*) AS count
       FROM verse_omissions o
       JOIN translations t ON t.translation_id = o.translation_id
       GROUP BY t.translation_id
       ORDER BY count DESC`,
    )
    .all() as { code: string; name: string; count: number }[];
}

/**
 * Whether a translation includes a book at all — a different question from whether it prints
 * a particular verse, and the whole reason `translation_books` exists beside `verse_omissions`.
 *
 * Asked BEFORE the passage query in the reader, not after it comes back empty. "No text" has
 * two causes with two different answers — this edition has no New Testament, or the reference
 * is genuinely nowhere — and a page that cannot tell them apart either 404s on a legitimate
 * reference or invents an explanation for a typo.
 */
export function getBookScope(bookId: number, translationId: number): "printed" | "out_of_scope" | null {
  const row = prepared(
    `SELECT status FROM translation_books WHERE translation_id = ? AND book_id = ?`,
  ).get(translationId, bookId) as { status: string } | undefined;
  if (row?.status === "printed" || row?.status === "out_of_scope") return row.status;
  return null;
}

/**
 * The translations that do print a book, for the "read it in one of these instead" offer.
 *
 * Ordered by translation_id, which is load order and therefore roughly the order the picker
 * shows — a reader scanning the banner and then the switcher sees the same sequence twice.
 */
export function getTranslationsPrintingBook(
  bookId: number,
  excludeTranslationId: number,
): { code: string; name: string }[] {
  return prepared(
    `SELECT t.code, t.name
     FROM translation_books tb
     JOIN translations t USING (translation_id)
     WHERE tb.book_id = ? AND tb.status = 'printed'
       AND tb.translation_id != ? AND t.is_licensed = 1
     ORDER BY t.translation_id`,
  ).all(bookId, excludeTranslationId) as { code: string; name: string }[];
}

/**
 * Every other licensed translation that has text for one specific verse.
 *
 * The verse-level counterpart to `getTranslationsPrintingBook`. Both exist because "no text
 * here" has more than one cause: the book is not in this edition (scope), the earliest
 * manuscripts lack the verse (transmission), or this particular source file simply skips it
 * with nothing recorded either way. Only `verse_texts` can answer the last one, and it is the
 * case that put a 404 on `/read/Acts.8.37?t=WEB`.
 */
export function getTranslationsPrintingVerse(
  verseId: VerseId,
  excludeTranslationId: number,
): { code: string; name: string }[] {
  return prepared(
    `SELECT t.code, t.name
     FROM verse_texts vt
     JOIN translations t ON t.translation_id = vt.translation_id
     WHERE vt.verse_id = ? AND vt.translation_id != ? AND t.is_licensed = 1
     ORDER BY t.translation_id`,
  ).all(verseId, excludeTranslationId) as { code: string; name: string }[];
}

export interface OmittedVerse {
  verseId: VerseId;
  osisRef: string;
  reason: string;
  history: string;
  /** Codes of the loaded translations that leave this verse out. */
  omittedBy: string[];
  /**
   * A translation that DOES print it, so the reader has somewhere to go. Undefined only if every
   * loaded translation omits the verse — in which case there is no honest link to offer.
   */
  printedBy: { code: string; name: string } | undefined;
}

/**
 * Every omitted verse, ONE ROW PER VERSE, for the textual-criticism index.
 *
 * It used to be one row per (translation, verse) pair, which was fine when the corpus held two
 * translations and one of them followed the critical text. With seven loaded it became 35 rows
 * over about a dozen verses, and the home page dutifully announced "35 verses that some Bibles
 * leave out" above a list that repeated Mark 9:44 five times. The number of rows in a join table
 * is not a count of anything a reader cares about.
 *
 * `printedBy` is resolved here rather than guessed at the call site. The previous caller picked
 * "the first translation whose code differs from the omitting one", which is not the same
 * question at all: with five critical-text editions loaded, the first different code is usually
 * another edition that omits the same verse, so the "read it in another translation" link led to
 * the identical gap. This asks `verse_omissions` who is missing it and takes someone who is not.
 */
export function getAllOmissions(): OmittedVerse[] {
  const rows = prepared(
    `SELECT o.verse_id AS verseId,
            v.osis_ref  AS osisRef,
            v.book_id   AS bookId,
            -- Reasons are per-translation rows but describe the manuscript evidence, which is a
            -- property of the verse; they are identical across translations in practice, so the
            -- lowest translation_id's wins rather than concatenating a dozen copies.
            MIN(o.reason) AS reason,
            MIN(o.history) AS history,
            GROUP_CONCAT(t.code) AS omittedBy
     FROM verse_omissions o
     JOIN verses v ON v.verse_id = o.verse_id
     JOIN translations t ON t.translation_id = o.translation_id AND t.is_licensed = 1
     GROUP BY o.verse_id
     ORDER BY v.canon_order`,
  ).all() as { verseId: VerseId; osisRef: string; bookId: number; reason: string; history: string; omittedBy: string }[];

  return rows.map((row) => ({
    verseId: row.verseId,
    osisRef: row.osisRef,
    reason: row.reason,
    history: row.history,
    omittedBy: row.omittedBy.split(","),
    printedBy: getFirstPrinterOfVerse(row.verseId),
  }));
}

/**
 * The first licensed translation that actually has text for a verse.
 *
 * Asked of `verse_texts`, which is the only table that knows. The obvious cheaper answer —
 * "any translation not listed in this verse's `verse_omissions` rows" — is wrong, and wrong in
 * a way that produced a 404 on the live site: a translation can be missing a verse WITHOUT an
 * omission row, because the ingest records an omission only where its source supplies an empty
 * string, and a source that simply skips the verse leaves nothing to record. WEB does exactly
 * that for Acts 8:37 and Acts 15:34, so "not in `omittedBy`" named WEB as the place to go read
 * them and the link 404'd.
 *
 * Absence of evidence about an omission is not evidence the verse is printed. Ask for the text.
 */
const getFirstPrinterOfVerse = cache((verseId: VerseId): { code: string; name: string } | undefined => {
  return prepared(
    `SELECT t.code, t.name
     FROM verse_texts vt
     JOIN translations t ON t.translation_id = vt.translation_id
     WHERE vt.verse_id = ? AND t.is_licensed = 1
     ORDER BY t.translation_id
     LIMIT 1`,
  ).get(verseId) as { code: string; name: string } | undefined;
});
