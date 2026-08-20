import "server-only";

import { cache } from "react";

import { BookIndex, type BookRecord } from "@/lib/refs/book-index";
import type { VerseId, VerseRange } from "@/lib/refs/verse-id";
import {
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  parseHighlightMarkers,
  sanitizeFtsQuery,
  type MatchOffset,
} from "@/lib/search/query";
import { prepared } from "./client";

/**
 * Corpus queries.
 *
 * Note how uniform these are: nearly everything is `WHERE verse_id BETWEEN ? AND ?`. That is
 * the payoff of the canonical verse-id design — a hover tooltip fetching one verse and the
 * reader fetching all of Romans run the *same* query with different bounds, hitting the same
 * b-tree index. No feature needs its own access path.
 */

export interface VerseText {
  verseId: VerseId;
  chapter: number;
  verse: number;
  text: string;
  /** Reference-density bucket 1-5, or 0 when the verse has no inbound references. */
  heatBucket: number;
}

export interface CrossReference {
  fromVerseId: VerseId;
  toStartVerse: VerseId;
  toEndVerse: VerseId;
  votes: number;
  source: string;
}

export interface Translation {
  translationId: number;
  code: string;
  name: string;
  language: string;
  license: string;
  copyrightNotice: string;
  /** 'all' | 'OT' | 'NT' — which testament(s) this edition covers. */
  scope: string;
  /** Reader-facing sentence explaining a partial scope. Empty for a whole Bible. */
  scopeNote: string;
}

/** The canon, loaded once per request and memoized for the process. */
export const getBooks = cache((): BookRecord[] =>
  prepared(
    `SELECT book_id AS bookId, osis_id AS osisId, name, abbreviation, testament,
            chapter_count AS chapterCount
     FROM books ORDER BY book_id`
  ).all() as BookRecord[]
);

export const getBookIndex = cache((): BookIndex => new BookIndex(getBooks()));

export const getTranslations = cache((): Translation[] =>
  prepared(
    `SELECT translation_id AS translationId, code, name, language, license,
            copyright_notice AS copyrightNotice, scope, scope_note AS scopeNote
     FROM translations WHERE is_licensed = 1 ORDER BY translation_id`
  ).all() as Translation[]
);

export const getTranslationByCode = cache((code: string): Translation | undefined =>
  getTranslations().find((t) => t.code.toUpperCase() === code.toUpperCase())
);

/**
 * Fetch the text of a range in one translation.
 *
 * LEFT JOIN on heat so verses with no inbound references still return (there are ~117 of
 * them); an INNER JOIN here would silently drop verses from the reader.
 */
export function getPassage(range: VerseRange, translationId: number): VerseText[] {
  return prepared(
    `SELECT vt.verse_id AS verseId, v.chapter, v.verse, vt.text,
            COALESCE(h.heat_bucket, 0) AS heatBucket
     FROM verse_texts vt
     JOIN verses v ON v.verse_id = vt.verse_id
     LEFT JOIN verse_reference_heat h ON h.verse_id = vt.verse_id
     WHERE vt.translation_id = ? AND vt.verse_id BETWEEN ? AND ?
     ORDER BY vt.verse_id`
  ).all(translationId, range.start, range.end) as VerseText[];
}

/**
 * The same range in several translations at once, grouped by verse.
 *
 * Used by the parallel/compare views. One query rather than N, so switching translations
 * never costs a waterfall.
 */
export function getPassageMulti(
  range: VerseRange,
  translationIds: readonly number[]
): Map<number, Map<VerseId, string>> {
  if (translationIds.length === 0) return new Map();
  const placeholders = translationIds.map(() => "?").join(",");
  const rows = prepared(
    `SELECT translation_id AS translationId, verse_id AS verseId, text
     FROM verse_texts
     WHERE translation_id IN (${placeholders}) AND verse_id BETWEEN ? AND ?
     ORDER BY verse_id`
  ).all(...translationIds, range.start, range.end) as {
    translationId: number;
    verseId: VerseId;
    text: string;
  }[];

  const out = new Map<number, Map<VerseId, string>>();
  for (const row of rows) {
    let byVerse = out.get(row.translationId);
    if (!byVerse) {
      byVerse = new Map();
      out.set(row.translationId, byVerse);
    }
    byVerse.set(row.verseId, row.text);
  }
  return out;
}

/** References pointing OUT of any verse in the range, strongest first. */
export function getOutboundReferences(range: VerseRange, minVotes = 0): CrossReference[] {
  return prepared(
    `SELECT from_verse_id AS fromVerseId, to_start_verse AS toStartVerse,
            to_end_verse AS toEndVerse, votes, source
     FROM cross_references
     WHERE from_verse_id BETWEEN ? AND ? AND votes >= ?
     ORDER BY votes DESC`
  ).all(range.start, range.end, minVotes) as CrossReference[];
}

/**
 * References pointing INTO the range.
 *
 * The predicate is the standard interval-overlap test rather than `BETWEEN`, because a
 * reference target is itself a range and may only partially cover what we asked for.
 */
export function getInboundReferences(range: VerseRange, minVotes = 0): CrossReference[] {
  return prepared(
    `SELECT from_verse_id AS fromVerseId, to_start_verse AS toStartVerse,
            to_end_verse AS toEndVerse, votes, source
     FROM cross_references
     WHERE to_start_verse <= ? AND to_end_verse >= ? AND votes >= ?
     ORDER BY votes DESC`
  ).all(range.end, range.start, minVotes) as CrossReference[];
}

/** Chapter count for a book — used to build navigation without loading every verse. */
export function getChapterCount(bookId: number): number {
  const row = prepared(`SELECT chapter_count AS n FROM books WHERE book_id = ?`).get(bookId) as
    | { n: number }
    | undefined;
  return row?.n ?? 0;
}

/** Last verse number in a chapter — the real end of a chapter range, not the 999 upper bound. */
export function getChapterLastVerse(bookId: number, chapter: number): number {
  const row = prepared(
    `SELECT MAX(verse) AS n FROM verses WHERE book_id = ? AND chapter = ?`
  ).get(bookId, chapter) as { n: number | null } | undefined;
  return row?.n ?? 0;
}

/** Verses that actually exist in a range. Ranges are sparse, so never assume contiguity. */
export function getExistingVerseIds(range: VerseRange): VerseId[] {
  return (
    prepared(`SELECT verse_id AS id FROM verses WHERE verse_id BETWEEN ? AND ? ORDER BY verse_id`).all(
      range.start,
      range.end
    ) as { id: VerseId }[]
  ).map((r) => r.id);
}

/**
 * Which of these specific ids are real verses.
 *
 * `getExistingVerseIds` answers the same question for a *range*, and is the wrong tool when
 * the two ids may be a whole testament apart — validating an annotation anchored Genesis 1:1
 * to Revelation 22:21 would pull 31,095 rows to check two of them. This is the point lookup.
 */
export function versesExist(verseIds: readonly number[]): Set<number> {
  if (verseIds.length === 0) return new Set();
  const unique = [...new Set(verseIds)];
  const placeholders = unique.map(() => "?").join(",");
  const rows = prepared(
    `SELECT verse_id AS id FROM verses WHERE verse_id IN (${placeholders})`
  ).all(...unique) as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

/**
 * Character length of specific verses in one translation.
 *
 * Annotation offsets are indexes into exactly this string (stored plain and NFC-normalized,
 * ARCHITECTURE §3.1), so this is what an offset has to be bounded by. Returns lengths rather
 * than text so a validation path never carries scripture it does not need.
 *
 * SQLite's `LENGTH` counts code points where JavaScript's `.length` counts UTF-16 code units.
 * They agree for every character in this corpus, which is entirely inside the BMP — but a
 * future translation carrying astral-plane text (original-language scripts with rare
 * characters, say) would make the two disagree, and offsets are exactly the thing that breaks
 * quietly when they do.
 */
export function getVerseTextLengths(
  verseIds: readonly number[],
  translationId: number
): Map<number, number> {
  if (verseIds.length === 0) return new Map();
  const unique = [...new Set(verseIds)];
  const placeholders = unique.map(() => "?").join(",");
  const rows = prepared(
    `SELECT verse_id AS verseId, LENGTH(text) AS len
     FROM verse_texts WHERE translation_id = ? AND verse_id IN (${placeholders})`
  ).all(translationId, ...unique) as { verseId: number; len: number }[];
  return new Map(rows.map((r) => [r.verseId, r.len]));
}

export interface ChapterSummary {
  bookId: number;
  osisId: string;
  bookName: string;
  chapter: number;
  verseCount: number;
}

/**
 * The chapters a range actually contains, with their real verse counts.
 *
 * Derived from the `verses` table rather than from `books.chapter_count` and arithmetic,
 * because the id space is sparse: a chapter's verse count is a fact about the corpus, and the
 * reader's chapter index states it, so it has to be counted rather than assumed.
 */
export function getChapterSummary(range: VerseRange): ChapterSummary[] {
  return prepared(
    `SELECT v.book_id AS bookId, b.osis_id AS osisId, b.name AS bookName,
            v.chapter, COUNT(*) AS verseCount
     FROM verses v
     JOIN books b ON b.book_id = v.book_id
     WHERE v.verse_id BETWEEN ? AND ?
     GROUP BY v.book_id, v.chapter
     ORDER BY v.book_id, v.chapter`
  ).all(range.start, range.end) as ChapterSummary[];
}

// --- Cross-reference support (apps/web/src/lib/crossrefs, /api/xrefs, /api/graph) ----------
//
// Appended rather than interleaved above, per the ownership split for this feature: the
// functions above this line belong to the reader and are not to be altered.

/**
 * The first verse of one or more ranges, keyed by the range's start verse id.
 *
 * Cross-reference panels preview a target passage without a second round trip: given the
 * `to_start_verse` of every candidate xref, this fetches just enough text (one verse each) to
 * render a `<PassageRenderer density="panel">` snippet.
 */
export function getFirstVerseTexts(
  verseIds: readonly VerseId[],
  translationId: number
): Map<VerseId, VerseText> {
  if (verseIds.length === 0) return new Map();
  // Dedup — a hub verse like Isaiah 53:5 can be the target of dozens of xrefs from the same
  // start verse, and there is no reason to fetch it more than once.
  const unique = [...new Set(verseIds)];
  const placeholders = unique.map(() => "?").join(",");
  const rows = prepared(
    `SELECT vt.verse_id AS verseId, v.chapter, v.verse, vt.text,
            COALESCE(h.heat_bucket, 0) AS heatBucket
     FROM verse_texts vt
     JOIN verses v ON v.verse_id = vt.verse_id
     LEFT JOIN verse_reference_heat h ON h.verse_id = vt.verse_id
     WHERE vt.translation_id = ? AND vt.verse_id IN (${placeholders})`
  ).all(translationId, ...unique) as VerseText[];

  const out = new Map<VerseId, VerseText>();
  for (const row of rows) out.set(row.verseId, row);
  return out;
}

/**
 * Outbound references, capped to the top `limit` by vote weight.
 *
 * A `LIMIT` in SQL rather than slicing in JS, so a hub verse's fan-out never leaves the
 * database — this is the degree cap the deep-dive graph relies on to stay responsive around
 * high-degree verses (Isaiah 53 has hundreds of inbound refs alone).
 */
export function getOutboundReferencesLimited(
  range: VerseRange,
  minVotes: number,
  limit: number
): CrossReference[] {
  return prepared(
    `SELECT from_verse_id AS fromVerseId, to_start_verse AS toStartVerse,
            to_end_verse AS toEndVerse, votes, source
     FROM cross_references
     WHERE from_verse_id BETWEEN ? AND ? AND votes >= ?
     ORDER BY votes DESC
     LIMIT ?`
  ).all(range.start, range.end, minVotes, limit) as CrossReference[];
}

/** Inbound references, capped to the top `limit` by vote weight. See {@link getOutboundReferencesLimited}. */
export function getInboundReferencesLimited(
  range: VerseRange,
  minVotes: number,
  limit: number
): CrossReference[] {
  return prepared(
    `SELECT from_verse_id AS fromVerseId, to_start_verse AS toStartVerse,
            to_end_verse AS toEndVerse, votes, source
     FROM cross_references
     WHERE to_start_verse <= ? AND to_end_verse >= ? AND votes >= ?
     ORDER BY votes DESC
     LIMIT ?`
  ).all(range.end, range.start, minVotes, limit) as CrossReference[];
}

/** Total count of outbound references for a range (respects `minVotes`, ignores any limit) — used to disclose truncation. */
export function countOutboundReferences(range: VerseRange, minVotes: number): number {
  const row = prepared(
    `SELECT COUNT(*) AS n FROM cross_references WHERE from_verse_id BETWEEN ? AND ? AND votes >= ?`
  ).get(range.start, range.end, minVotes) as { n: number };
  return row.n;
}

/** Total count of inbound references for a range (respects `minVotes`, ignores any limit) — used to disclose truncation. */
export function countInboundReferences(range: VerseRange, minVotes: number): number {
  const row = prepared(
    `SELECT COUNT(*) AS n FROM cross_references WHERE to_start_verse <= ? AND to_end_verse >= ? AND votes >= ?`
  ).get(range.end, range.start, minVotes) as { n: number };
  return row.n;
}

/**
 * Distinct cross-reference records touching a range in EITHER direction.
 *
 * NOT `countOutbound + countInbound`. A record whose source verse falls inside the range and
 * whose target range also overlaps it satisfies both predicates: it is one link in the corpus,
 * counted twice by the sum. John 3 has 658 outbound and 780 inbound but 1,406 distinct records,
 * because 32 of them run both ways — the sum overstates the corpus by exactly that overlap, and
 * a headline number that double-counts is worse than no headline in a research tool.
 *
 * The `OR` is served by the two existing indexes (`cross_references_from_verse_id_idx`,
 * `cross_references_to_range_idx`); SQLite's OR-optimization takes their union rather than
 * scanning, and even the degenerate scan is 345k rows of integers.
 */
export function countUniqueReferences(range: VerseRange, minVotes: number): number {
  const row = prepared(
    `SELECT COUNT(*) AS n FROM cross_references
     WHERE votes >= ?
       AND ((from_verse_id BETWEEN ? AND ?)
            OR (to_start_verse <= ? AND to_end_verse >= ?))`
  ).get(minVotes, range.start, range.end, range.end, range.start) as { n: number };
  return row.n;
}

// --- Home page (§ landing) -------------------------------------------------------------
//
// Corpus-wide facts and entry points, computed from real rows rather than hardcoded — the
// home page's promise to a researcher is that every number on it is a live query result.

/** The canon for the "browse by book" surface, with genre attached for grouping. */
export function getBookBrowseIndex(): {
  bookId: number;
  osisId: string;
  name: string;
  testament: "OT" | "NT" | "DC";
  genres: string[];
  chapterCount: number;
}[] {
  const rows = prepared(
    `SELECT book_id AS bookId, osis_id AS osisId, name, testament, genre,
            chapter_count AS chapterCount
     FROM books ORDER BY book_id`
  ).all() as { bookId: number; osisId: string; name: string; testament: string; genre: string; chapterCount: number }[];
  // `genre` is stored as a JSON array (a book can be both law and narrative); parsed here so
  // the pure grouping logic in lib/home/bookGroups.ts never has to know it was ever a string.
  return rows.map((r) => ({
    ...r,
    testament: r.testament as "OT" | "NT" | "DC",
    genres: JSON.parse(r.genre) as string[],
  }));
}

/**
 * A `VerseText` (the shape `<PassageRenderer>` renders) plus the osis form and inbound count a
 * doorway card needs — extending rather than reshaping it, so the preview can be handed to
 * `PassageRenderer` exactly the way `CrossRefPanel` hands it `item.preview`.
 */
export interface HeatVerse extends VerseText {
  osisRef: string;
  inboundCount: number;
}

/** The most cross-referenced verses in the corpus — a real doorway, not an editorial pick. */
export function getMostReferencedVerses(translationId: number, limit: number): HeatVerse[] {
  return prepared(
    `SELECT h.verse_id AS verseId, v.osis_ref AS osisRef, v.chapter, v.verse, vt.text,
            h.heat_bucket AS heatBucket, h.inbound_count AS inboundCount
     FROM verse_reference_heat h
     JOIN verses v ON v.verse_id = h.verse_id
     JOIN verse_texts vt ON vt.verse_id = h.verse_id AND vt.translation_id = ?
     ORDER BY h.inbound_count DESC
     LIMIT ?`
  ).all(translationId, limit) as HeatVerse[];
}

/** Total verse count — stated on the home page so a researcher knows the corpus's real size. */
export const getVerseCount = cache((): number => {
  const row = prepared(`SELECT COUNT(*) AS n FROM verses`).get() as { n: number };
  return row.n;
});

/** Total cross-reference edge count, across all sources. */
export const getCrossReferenceCount = cache((): number => {
  const row = prepared(`SELECT COUNT(*) AS n FROM cross_references`).get() as { n: number };
  return row.n;
});

// --- Derash: full-text search (apps/web/src/app/derash, /api/search) --------------------

export interface SearchHit {
  verseId: VerseId;
  chapter: number;
  verse: number;
  text: string;
  heatBucket: number;
  bookId: number;
  bookName: string;
  /** Character ranges in `text` where a query term matched — feeds decoration kind "search-hit". */
  matches: MatchOffset[];
}

export interface SearchBookCount {
  bookId: number;
  bookName: string;
  count: number;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Total matches for the current translation + testament/book filters (before LIMIT/OFFSET). */
  total: number;
  /** Match count per book — always computed with the testament filter but WITHOUT the book
   *  filter, so picking a book to narrow into doesn't erase the map of where else it clusters. */
  bookDistribution: SearchBookCount[];
}

export interface SearchFilters {
  testament?: "OT" | "NT" | "DC";
  bookId?: number;
  limit: number;
  offset: number;
}

const EMPTY_RESULT: SearchResult = { hits: [], total: 0, bookDistribution: [] };

/**
 * Full-text search over one translation, backed by the `verse_texts_fts` FTS5 index built at
 * ingest time (packages/ingest/src/ingest.ts).
 *
 * Two things about the query shape are load-bearing, not stylistic:
 *
 * 1. The FTS5 table is referenced by its bare name everywhere (`verse_texts_fts`, never
 *    `verse_texts_fts AS f`) — aliasing it made `highlight()`/`bm25()` throw "no such column"
 *    against this SQLite build, for reasons that were not worth chasing further once the
 *    workaround was this cheap.
 * 2. `highlight()` is used instead of the more obvious `offsets()` because `offsets()` throws
 *    "unable to use function offsets in the requested context" the moment the query joins out
 *    to `verses`/`books` — which every call here does, for book/testament filtering and
 *    display metadata. `highlight()` has no such restriction. See `parseHighlightMarkers` for
 *    how its marked-up output becomes plain `{start,end}` offsets without ever writing markup
 *    back into anything persisted.
 */
export function searchVerses(query: string, translationId: number, filters: SearchFilters): SearchResult {
  const ftsQuery = sanitizeFtsQuery(query);
  if (!ftsQuery) return EMPTY_RESULT;

  const resultConditions = ["verse_texts_fts.translation_id = ?"];
  const resultParams: (string | number)[] = [translationId];
  const distConditions = ["verse_texts_fts.translation_id = ?"];
  const distParams: (string | number)[] = [translationId];

  if (filters.testament) {
    resultConditions.push("books.testament = ?");
    resultParams.push(filters.testament);
    distConditions.push("books.testament = ?");
    distParams.push(filters.testament);
  }
  if (filters.bookId !== undefined) {
    resultConditions.push("verses.book_id = ?");
    resultParams.push(filters.bookId);
    // Deliberately NOT added to distConditions — see SearchResult.bookDistribution above.
  }

  let rows: {
    verseId: number;
    chapter: number;
    verse: number;
    bookId: number;
    bookName: string;
    heatBucket: number;
    marked: string;
  }[];
  let total: number;
  let distribution: SearchBookCount[];

  try {
    rows = prepared(
      `SELECT verse_texts_fts.verse_id AS verseId, verses.chapter, verses.verse,
              verses.book_id AS bookId, books.name AS bookName,
              COALESCE(verse_reference_heat.heat_bucket, 0) AS heatBucket,
              highlight(verse_texts_fts, 0, ?, ?) AS marked
       FROM verse_texts_fts
       JOIN verses ON verses.verse_id = verse_texts_fts.verse_id
       JOIN books ON books.book_id = verses.book_id
       LEFT JOIN verse_reference_heat ON verse_reference_heat.verse_id = verse_texts_fts.verse_id
       WHERE verse_texts_fts MATCH ? AND ${resultConditions.join(" AND ")}
       ORDER BY bm25(verse_texts_fts) ASC
       LIMIT ? OFFSET ?`
    ).all(HIGHLIGHT_START, HIGHLIGHT_END, ftsQuery, ...resultParams, filters.limit, filters.offset) as typeof rows;

    total = (
      prepared(
        `SELECT COUNT(*) AS n
         FROM verse_texts_fts
         JOIN verses ON verses.verse_id = verse_texts_fts.verse_id
         JOIN books ON books.book_id = verses.book_id
         WHERE verse_texts_fts MATCH ? AND ${resultConditions.join(" AND ")}`
      ).get(ftsQuery, ...resultParams) as { n: number }
    ).n;

    distribution = prepared(
      `SELECT verses.book_id AS bookId, books.name AS bookName, COUNT(*) AS count
       FROM verse_texts_fts
       JOIN verses ON verses.verse_id = verse_texts_fts.verse_id
       JOIN books ON books.book_id = verses.book_id
       WHERE verse_texts_fts MATCH ? AND ${distConditions.join(" AND ")}
       GROUP BY verses.book_id
       ORDER BY count DESC`
    ).all(ftsQuery, ...distParams) as SearchBookCount[];
  } catch (error) {
    // `sanitizeFtsQuery` only ever emits quoted words and trailing-`*` prefixes, which are
    // always valid FTS5 syntax — this is a last-resort guard so a tokenizer edge case we
    // failed to anticipate degrades to "no results" rather than a 500.
    if (error instanceof Error && /fts5|syntax error/i.test(error.message)) return EMPTY_RESULT;
    throw error;
  }

  const hits: SearchHit[] = rows.map((row) => {
    const matches = parseHighlightMarkers(row.marked);
    return {
      verseId: row.verseId as VerseId,
      chapter: row.chapter,
      verse: row.verse,
      // Reconstruct the plain text by stripping markers rather than selecting a second,
      // separate `text` column — `highlight()` never alters the surrounding characters, so
      // this is exactly `verse_texts.text` with zero extra columns or joins.
      text: stripHighlightMarkers(row.marked),
      heatBucket: row.heatBucket,
      bookId: row.bookId,
      bookName: row.bookName,
      matches,
    };
  });

  return { hits, total, bookDistribution: distribution };
}

function stripHighlightMarkers(marked: string): string {
  return marked.split(HIGHLIGHT_START).join("").split(HIGHLIGHT_END).join("");
}
