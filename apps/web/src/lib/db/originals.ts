import "server-only";

import { cache } from "react";

import type { VerseId, VerseRange } from "@/lib/refs/verse-id";
import { groupForms, type InflectedForm } from "./inflection";
import { prepared } from "./client";

/**
 * Original-language queries: the Hebrew/Aramaic Bible (WLC) and the Greek New Testament
 * (SBLGNT).
 *
 * These are word-level texts, which is the whole reason they are here — a verse-level text can
 * be read, but only a word-level one can answer "every occurrence of this lemma, with its
 * morphology", which is the first thing a researcher tries.
 *
 * Same shape as `corpus.ts`: nearly everything is `WHERE verse_id BETWEEN ? AND ?`, because the
 * canonical verse id is the only address in the system. An interlinear under a hover tooltip and
 * an interlinear under the full reader are the same query with different bounds.
 */

export interface OriginalWord {
  wordId: number;
  textId: number;
  verseId: VerseId;
  /** The source's own reference (`Ps.51.2`), which for the Hebrew is NOT always the canonical one. */
  sourceRef: string;
  position: number;
  surface: string;
  normalized: string;
  lemma: string;
  strongs: string | null;
  /** The source's morphology code, unmodified. Decoded for display by `lib/morphology`. */
  morph: string;
  language: string;
  /**
   * Dictionary headword and transliteration, joined from `original_lexicon`.
   *
   * Null for Greek, which carries no Strong's number here and whose `lemma` is already a proper
   * headword — see `gloss` below for where the Greek word's dictionary information comes from
   * instead. For Hebrew and Aramaic these are the only displayable form of the word's dictionary
   * identity — `lemma` is the raw OSIS attribute and must not be shown on its own.
   */
  headword: string | null;
  xlit: string | null;
  /**
   * One-word gloss. For Hebrew/Aramaic, from `original_lexicon` (joined on `strongs`); for
   * Greek, from `greek_lexicon` (joined on `lemma`, which for Greek already IS the headword —
   * see `getInterlinear` for the two-pass match). Null when nothing resolved, which the ingest
   * gate keeps under 2% of Greek word tokens and effectively 0% of Hebrew ones.
   */
  gloss: string | null;
  /** Full Dodson definition for Greek, when the lemma resolves; null for Hebrew rows. */
  definition: string | null;
}

export interface OriginalVariant extends Omit<OriginalWord, "wordId"> {
  variantId: number;
  kind: string;
  catchWord: string | null;
}

export interface GreekEditionVariant {
  variantId: number;
  verseId: VerseId;
  sourceRef: string;
  sourcePosition: number;
  baseSurface: string;
  baseEditions: string;
  alternateSurface: string | null;
  alternateEditions: string | null;
  note: string | null;
}

export interface GreekManuscriptReading {
  variantId: number;
  verseId: VerseId;
  sourceRef: string;
  readingOrder: number;
  readingText: string;
  witnesses: string;
  isBase: boolean;
}

export interface OriginalText {
  textId: number;
  code: string;
  name: string;
  language: string;
  testament: string;
  license: string;
  attribution: string;
  sourceUrl: string;
  versification: string;
}

export const getOriginalTexts = cache((): OriginalText[] =>
  prepared(
    `SELECT text_id AS textId, code, name, language, testament, license, attribution,
            source_url AS sourceUrl, versification
     FROM original_texts ORDER BY text_id`
  ).all() as OriginalText[]
);

/**
 * The original-language words under a passage, in reading order.
 *
 * Returns words from BOTH texts without filtering by testament: the Hebrew covers book_id 1-39
 * and the Greek 40-66, so a range is naturally served by whichever text contains it, and a
 * range spanning the testament boundary correctly returns both. Filtering by a caller-supplied
 * text id would make that caller responsible for knowing which testament it is in, which is
 * exactly the kind of knowledge that ends up duplicated and then wrong.
 */
export function getInterlinear(range: VerseRange): OriginalWord[] {
  const rows = prepared(
    // The lexicon join is what makes the middle line of the interlinear readable. Without it the
    // Hebrew shows `b/2617 a` — the OSIS lemma attribute, which is a Strong's number wearing its
    // prefix morphemes. `headword` is the pointed dictionary form a reader can actually use.
    //
    // The `'H' || SUBSTR(...)` expression is on the LEFT table's column, so `entry_key` — the
    // lexicon's primary key — is still matched by equality and its index still applies. Written
    // the other way round (`SUBSTR(l.entry_key, 2) = ...`) it would scan all 9,831 entries per
    // word, which for a chapter of Hebrew is several million comparisons for one page.
    //
    // LEFT, not INNER: Greek carries no Strong's number in this corpus, and an inner join would
    // silently drop the entire New Testament out of the interlinear.
    //
    // GREEK GLOSS, first pass: a correlated scalar subquery rather than a second LEFT JOIN,
    // because `greek_lexicon.headword` is NOT unique (3 of 5,410 headwords are genuine Greek
    // homographs — see the schema comment in packages/ingest/src/ingest.ts). A plain JOIN on a
    // non-unique key would multiply that word's row in the result; `LIMIT 1` with a
    // deterministic tie-break (lowest entry_key) keeps exactly one row per word instead. This
    // resolves the exact-NFC-match majority; the diacritic-stripped fallback for the residual
    // runs as a second pass below, in application code, because it needs `stripGreekDiacritics`
    // — duplicating that fold into SQL is exactly the kind of drift the ingest gate exists to
    // catch, so it stays out of the query.
    `SELECT w.word_id AS wordId, w.text_id AS textId, w.verse_id AS verseId,
            w.source_ref AS sourceRef, w.position, w.surface, w.normalized, w.lemma, w.strongs,
            w.morph, w.language, l.headword, l.xlit,
            COALESCE(
              l.gloss,
              (SELECT gl.gloss FROM greek_lexicon gl
                WHERE gl.headword = w.lemma
                ORDER BY gl.entry_key LIMIT 1)
            ) AS gloss,
            (SELECT gl.definition FROM greek_lexicon gl
              WHERE gl.headword = w.lemma
              ORDER BY gl.entry_key LIMIT 1) AS definition
     FROM original_words w
     LEFT JOIN original_lexicon l ON l.entry_key = 'H' || SUBSTR(w.strongs, 2)
     WHERE w.verse_id BETWEEN ? AND ?
     ORDER BY w.verse_id, w.position`
  ).all(range.start, range.end) as OriginalWord[];

  fillGreekGlossFallback(rows);
  return rows;
}

/**
 * Second pass of the Greek gloss match: diacritic-stripped `search_headword`, for the words the
 * exact-NFC pass in `getInterlinear`'s SQL left with no gloss.
 *
 * Mutates `rows` in place rather than returning a copy — this runs on every interlinear render
 * and the exact-match pass already resolves the large majority (the ingest gate requires 98% of
 * Greek TOKENS overall), so the common case is an empty `needsFallback` array and an early
 * return, not a second round trip.
 *
 * Batched by DISTINCT diacritic-stripped key, same shape as `getLexiconEntries` below, for the
 * same reason: a chapter of Greek is dozens of words, and one query per word would be dozens of
 * round trips for what is already the rarer path.
 */
function fillGreekGlossFallback(rows: OriginalWord[]): void {
  const needsFallback = rows.filter((r) => r.language === "grc" && r.gloss === null);
  if (needsFallback.length === 0) return;

  const keys = [...new Set(needsFallback.map((r) => stripGreekDiacritics(r.lemma)))];
  const glossByKey = new Map<string, { entryKey: string; gloss: string }>();

  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const candidates = prepared(
      `SELECT search_headword AS searchHeadword, entry_key AS entryKey, gloss
         FROM greek_lexicon WHERE search_headword IN (${chunk.map(() => "?").join(",")})`
    ).all(...chunk) as { searchHeadword: string; entryKey: string; gloss: string }[];
    for (const c of candidates) {
      // Same deterministic tie-break as the SQL first pass: lowest entry_key wins when a
      // stripped key is ambiguous (the same 3 homographs, now merged with anything that
      // happens to fold onto them).
      const existing = glossByKey.get(c.searchHeadword);
      if (!existing || c.entryKey < existing.entryKey) {
        glossByKey.set(c.searchHeadword, { entryKey: c.entryKey, gloss: c.gloss });
      }
    }
  }

  for (const row of needsFallback) {
    row.gloss = glossByKey.get(stripGreekDiacritics(row.lemma))?.gloss ?? null;
  }
}

/**
 * Marginal readings (qere) under a passage.
 *
 * Separate query rather than a join onto the words: most verses have none, and a LEFT JOIN
 * would multiply every word row by its variants for the handful that do. Across the whole Old
 * Testament there are 1,278 of these against 443,061 words, so for most chapters this returns
 * nothing at all.
 *
 * The lexicon join is the same one `getInterlinear` uses, and for the same reason: without it a
 * qere reads `1471 a` — the OSIS lemma attribute — where the reader needs the pointed headword
 * and its gloss. A marginal reading the reader cannot look up is not apparatus, it is a
 * curiosity. See `getInterlinear` for why the expression is on the LEFT table's column.
 */
export function getOriginalVariants(range: VerseRange): OriginalVariant[] {
  return prepared(
    `SELECT v.variant_id AS variantId, v.text_id AS textId, v.verse_id AS verseId,
            v.source_ref AS sourceRef, v.position, v.kind, v.catch_word AS catchWord,
            v.surface, v.normalized, v.lemma, v.strongs, v.morph, v.language,
            l.headword, l.xlit, l.gloss
     FROM original_variants v
     LEFT JOIN original_lexicon l ON l.entry_key = 'H' || SUBSTR(v.strongs, 2)
     WHERE v.verse_id BETWEEN ? AND ?
     ORDER BY v.verse_id, v.position, v.variant_id`
  ).all(range.start, range.end) as OriginalVariant[];
}

/** Edition-level differences retained from STEPBible TAGNT. These are not manuscript claims:
 * they say which published Greek editions print each reading, and the UI labels them that way. */
export function getGreekEditionVariants(range: VerseRange): GreekEditionVariant[] {
  return prepared(
    `SELECT variant_id AS variantId, verse_id AS verseId, source_ref AS sourceRef,
            source_position AS sourcePosition, base_surface AS baseSurface,
            base_editions AS baseEditions, alternate_surface AS alternateSurface,
            alternate_editions AS alternateEditions, note
     FROM greek_edition_variants
     WHERE verse_id BETWEEN ? AND ?
     ORDER BY verse_id, source_position, variant_id`
  ).all(range.start, range.end) as GreekEditionVariant[];
}

/** Witness-level Greek readings from CrossWire VarApp, grouped by source locus at render time. */
export function getGreekManuscriptReadings(range: VerseRange): GreekManuscriptReading[] {
  return prepared(
    `SELECT variant_id AS variantId, verse_id AS verseId, source_ref AS sourceRef,
            reading_order AS readingOrder, reading_text AS readingText, witnesses,
            is_base AS isBase
     FROM greek_manuscript_readings
     WHERE verse_id BETWEEN ? AND ?
     ORDER BY verse_id, source_ref, reading_order`
  ).all(range.start, range.end).map((row) => {
    const value = row as GreekManuscriptReading;
    return { ...value, isBase: Boolean(value.isBase) };
  });
}

export type { InflectedForm } from "./inflection";

export interface ConcordanceEntry {
  verseId: VerseId;
  sourceRef: string;
  position: number;
  surface: string;
  morph: string;
  language: string;
}

export interface ConcordanceSummary {
  /** The key as matched: a Strong's number (`H430`) or a lemma. */
  key: string;
  lemma: string;
  strongs: string | null;
  language: string;
  total: number;
  /** Distinct inflected forms this lemma appears in, most frequent first. See `groupForms`. */
  forms: InflectedForm[];
  /** True when `forms` was capped. Drives the page's disclosure; usually false. */
  formsTruncated: boolean;
  /** Which books it occurs in, in canonical order. */
  books: { bookId: number; count: number }[];
  /**
   * The dictionary entry, when this is a Hebrew/Aramaic key with one.
   *
   * Added because `lemma` is not displayable for the Hebrew: it holds the OSIS lemma attribute
   * verbatim (`b/2617 a`), which is a Strong's number with its prefix morphemes. Render
   * `lexicon.headword` and fall back to `lemma` — Greek has no Strong's numbers in this corpus,
   * so `lexicon` is always null there and `lemma` (`βίβλος`) is already the right thing.
   */
  lexicon: LexiconEntry | null;
  /** Full Dodson definition for a Greek lemma; unlike the Hebrew entry, this has no Strong's key. */
  greekLexicon: GreekLexiconEntry | null;
}

/**
 * How many inflected forms the concordance page will list.
 *
 * Applied AFTER the accentual fold, so it caps forms and not spellings. Set high on purpose:
 * the fold takes the typical Hebrew noun from ~88 rows to ~8, and even a fully attested verb
 * stays well inside this, so in practice nothing is capped and the page says nothing about a
 * cap. It exists only so a pathological lemma cannot render an unbounded list.
 */
const FORMS_CAP = 120;

/**
 * Is this a Strong's number (`H430`, `G26`, `H1254a`) rather than a lemma?
 *
 * Accepts the number alone (`430`) too, since that is what a reader copying from a printed
 * concordance will type — resolved against the Hebrew, which is the only side that carries
 * Strong's numbers in this corpus.
 */
export function parseStrongsKey(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = /^([HAG])?(\d{1,5})([A-Z])?$/.exec(s);
  if (!m) return null;
  const [, prefix, digits, homonym] = m;
  return `${prefix ?? "H"}${Number(digits)}${homonym?.toLowerCase() ?? ""}`;
}

/**
 * Folds a Greek word onto the form the corpus is indexed by: no accents, no breathings, lower
 * case. A reader types `λογος`; the printed text has `λόγος`.
 *
 * NFD decomposition splits every accent, breathing and iota subscript off its base letter as a
 * combining mark in U+0300–U+036F, which the replace removes. `toLowerCase` runs *after*, so
 * `Ἰησοῦ` reduces the same way `ἰησοῦ` does.
 *
 * **This is the query half of a pair.** The index half is `searchForm()` in
 * `packages/ingest/src/originals.ts`, which writes `original_words.search_form` at ingest time.
 * The two must agree character for character or the index answers a different question from the
 * one being asked; the ingest gate re-derives a known probe against the loaded column so a drift
 * fails the corpus build rather than silently returning nothing.
 *
 * Hebrew needs no equivalent: `normalized` is already the bare consonantal skeleton, because
 * stripping Hebrew pointing is a range deletion rather than a Unicode-normalization operation.
 */
export function stripGreekDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Every occurrence of a lemma or Strong's number, with counts. Null when nothing matches. */
export function getConcordanceSummary(rawKey: string): ConcordanceSummary | null {
  const strongs = parseStrongsKey(rawKey);
  const where = strongs ? `strongs = ?` : `lemma = ?`;
  const param = strongs ?? rawKey.trim();

  const head = prepared(
    `SELECT lemma, strongs, language, COUNT(*) AS total
     FROM original_words WHERE ${where}
     GROUP BY lemma, strongs, language
     ORDER BY total DESC LIMIT 1`
  ).get(param) as { lemma: string; strongs: string | null; language: string; total: number } | undefined;

  if (!head) return null;

  // No LIMIT here, and that is the point of the change. The query used to cap at 50 SPELLINGS
  // and the page reported the cap as a count of forms — a denominator taken before the
  // duplicates were removed, so both the "50 most frequent forms" claim and the "38 more forms"
  // that followed it described a quantity that does not exist. Capping has to happen after the
  // fold or it is capping the wrong thing. One lemma's distinct spellings is a few hundred rows
  // at the very worst, so reading them all costs nothing worth having.
  const spellings = prepared(
    `SELECT surface, morph, COUNT(*) AS count
     FROM original_words WHERE ${where}
     GROUP BY surface, morph ORDER BY count DESC, surface`
  ).all(param) as { surface: string; morph: string; count: number }[];

  const allForms = groupForms(spellings, head.language);
  const forms = allForms.slice(0, FORMS_CAP);

  const books = prepared(
    `SELECT verse_id / 1000000 AS bookId, COUNT(*) AS count
     FROM original_words WHERE ${where}
     GROUP BY bookId ORDER BY bookId`
  ).all(param) as { bookId: number; count: number }[];

  const total = prepared(`SELECT COUNT(*) AS n FROM original_words WHERE ${where}`).get(param) as {
    n: number;
  };

  return {
    key: param,
    lemma: head.lemma,
    strongs: head.strongs,
    language: head.language,
    total: total.n,
    forms,
    formsTruncated: allForms.length > forms.length,
    books,
    lexicon: head.strongs === null ? null : getLexiconEntry(head.strongs),
    greekLexicon: head.strongs === null ? getGreekLexiconEntry(head.lemma) : null,
  };
}

/** One page of occurrences. Paged because common lemmas run to tens of thousands. */
export function getConcordanceOccurrences(
  rawKey: string,
  limit: number,
  offset: number
): ConcordanceEntry[] {
  const strongs = parseStrongsKey(rawKey);
  const where = strongs ? `strongs = ?` : `lemma = ?`;
  const param = strongs ?? rawKey.trim();

  return prepared(
    `SELECT verse_id AS verseId, source_ref AS sourceRef, position, surface, morph, language
     FROM original_words WHERE ${where}
     ORDER BY verse_id, position
     LIMIT ? OFFSET ?`
  ).all(param, limit, offset) as ConcordanceEntry[];
}

export interface OriginalSearchOptions {
  language?: "hbo" | "arc" | "grc";
  morph?: string;
  limit: number;
  offset: number;
  translationId: number;
}

export interface OriginalSearchHit {
  verseId: VerseId;
  chapter: number;
  verse: number;
  text: string;
  bookId: number;
  bookName: string;
  surface: string;
  lemma: string;
  morph: string;
  language: string;
  position: number;
  strongs: string | null;
}

export interface OriginalSearchResult {
  total: number;
  hits: OriginalSearchHit[];
  bookDistribution: { bookId: number; bookName: string; count: number }[];
}

/**
 * Search the indexed original-language columns at verse grain.
 *
 * The UI calls this from Derash's "Original language" mode. A token match is useful only when
 * it lands on a readable verse, so the query counts and pages distinct verse_ids while retaining
 * the first matching word as the evidence label. `search_form` is the ingest-time folded column;
 * no Unicode function runs over 443k rows at request time.
 */
export function searchOriginalWords(query: string, options: OriginalSearchOptions): OriginalSearchResult {
  const raw = query.trim();
  const folded = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u0591-\u05c7]/g, "")
    .toLowerCase();
  const strongs = parseStrongsKey(raw);
  const clauses = [strongs ? "w.strongs = ?" : "(w.lemma LIKE ? OR w.search_form LIKE ?)" ];
  const params: unknown[] = strongs ? [strongs] : [raw, `${folded}%`];
  if (options.language) {
    clauses.push("w.language = ?");
    params.push(options.language);
  }
  if (options.morph?.trim()) {
    clauses.push("w.morph LIKE ?");
    params.push(`${options.morph.trim()}%`);
  }
  const where = clauses.join(" AND ");

  const totalRow = prepared(`SELECT COUNT(DISTINCT w.verse_id) AS n FROM original_words w WHERE ${where}`).get(...params) as { n: number };
  const books = prepared(
    `SELECT v.book_id AS bookId, b.name AS bookName, COUNT(DISTINCT w.verse_id) AS count
     FROM original_words w JOIN verses v ON v.verse_id = w.verse_id JOIN books b ON b.book_id = v.book_id
     WHERE ${where} GROUP BY v.book_id, b.name ORDER BY v.book_id`
  ).all(...params) as { bookId: number; bookName: string; count: number }[];

  const rows = prepared(
    `WITH matched AS (
       SELECT w.verse_id AS verseId, w.surface, w.lemma, w.morph, w.language, w.position, w.strongs,
              ROW_NUMBER() OVER (PARTITION BY w.verse_id ORDER BY w.position) AS rn
       FROM original_words w WHERE ${where}
     )
     SELECT m.verseId, v.chapter, v.verse, v.book_id AS bookId, b.name AS bookName,
            COALESCE(vt.text, '') AS text, m.surface, m.lemma, m.morph, m.language, m.position, m.strongs
     FROM matched m JOIN verses v ON v.verse_id = m.verseId JOIN books b ON b.book_id = v.book_id
     LEFT JOIN verse_texts vt ON vt.verse_id = m.verseId AND vt.translation_id = ?
     WHERE m.rn = 1 ORDER BY m.verseId LIMIT ? OFFSET ?`
  ).all(...params, options.translationId, options.limit, options.offset) as OriginalSearchHit[];

  return { total: totalRow.n, hits: rows, bookDistribution: books };
}

export interface LemmaSuggestion {
  lemma: string;
  strongs: string | null;
  language: string;
  count: number;
  /** A representative pointed/accented form, so the reader recognises the word. */
  surface: string;
  /**
   * Dictionary headword and gloss, when the key is Hebrew/Aramaic with a lexicon entry.
   *
   * Null for Greek, where `lemma` is already a real headword. For the Hebrew, `lemma` is a
   * Strong's number with prefix morphemes and must not be shown on its own.
   */
  headword: string | null;
  gloss: string | null;
}

export interface LemmaSuggestions {
  items: LemmaSuggestion[];
  /**
   * How many distinct words match in total, before `limit` is applied.
   *
   * Returned rather than left to be inferred from `items.length`: a caller cannot tell a result
   * of exactly `limit` from a truncated one, and "anything the tool caps must say so with the
   * real total" (AGENTS.md). A second COUNT over the same predicate is the price of being able
   * to say it.
   */
  total: number;
  limit: number;
}

/**
 * Lemma lookahead for the search box.
 *
 * Matches a Strong's number exactly, or a word by prefix — against the stored `lemma`, and
 * against `search_form`, which is the *indexed*, diacritic-stripped, unpointed form of every
 * word in the corpus.
 *
 * That column is why this is a search index and not a scan. The previous version passed a
 * stripped query into `normalized LIKE ?` while MorphGNT's `normalized` is still fully accented,
 * so `λογος` matched nothing and `λόγος` matched — a silent partial failure exactly where an
 * unaccented query is the normal thing to type. Stripping in SQL instead would have fixed the
 * answer and broken the performance: a function over the column defeats every index, which is
 * 443,061 expression evaluations per keystroke. The fold belongs where it can be indexed, which
 * is at ingest time. See `stripGreekDiacritics` for the pairing.
 */
export function suggestLemmas(rawQuery: string, limit = 20): LemmaSuggestions {
  const q = rawQuery.trim();
  if (q === "") return { items: [], total: 0, limit };

  const strongs = parseStrongsKey(q);
  // Both branches count DISTINCT (lemma, strongs, language) — the same grain the rows are
  // grouped by — so the total is comparable with `items.length` rather than being a word count
  // dressed up as a match count.
  const where = strongs
    ? { sql: `strongs = ?`, params: [strongs] as unknown[] }
    : {
        sql: `lemma LIKE ? ESCAPE '\\' OR search_form LIKE ? ESCAPE '\\'`,
        params: [likePrefix(q), likePrefix(searchForm(q))] as unknown[],
      };

  const rows = prepared(
    `SELECT lemma, strongs, language, COUNT(*) AS count, MIN(surface) AS surface
     FROM original_words WHERE ${where.sql}
     GROUP BY lemma, strongs, language
     ORDER BY count DESC LIMIT ?`
  ).all(...where.params, limit) as LemmaSuggestion[];

  const total = (
    prepared(
      `SELECT COUNT(*) AS n FROM (
         SELECT 1 FROM original_words WHERE ${where.sql}
         GROUP BY lemma, strongs, language)`
    ).get(...where.params) as { n: number }
  ).n;

  // One batched lexicon query for the whole page of suggestions, not one per row.
  const entries = getLexiconEntries(rows.map((r) => r.strongs).filter((s): s is string => s !== null));
  for (const row of rows) {
    const entry = row.strongs === null ? undefined : entries.get(row.strongs);
    row.headword = entry?.headword ?? null;
    row.gloss = entry?.gloss ?? null;
  }
  return { items: rows, total, limit };
}

/**
 * The query-side twin of `original_words.search_form`.
 *
 * One function for both scripts, because the caller does not know which script was typed and
 * must not have to guess: the Greek fold is a no-op on Hebrew (Hebrew points are not combining
 * marks in U+0300–U+036F) and the Hebrew fold is a no-op on Greek. Applying both unconditionally
 * is what lets a single `search_form LIKE ?` serve `λογος` and `חסד` from one indexed column.
 */
export function searchForm(s: string): string {
  return stripGreekDiacritics(stripHebrewPointing(s));
}

/**
 * Strip Hebrew points, accents and the source's morpheme separator.
 *
 * U+0591–U+05C7 is the whole apparatus the Masoretes added to the consonants — accents, vowel
 * points, meteg and the shin/sin dots — leaving the letters U+05D0–U+05EA, which is what a
 * reader searching unpointed is matching on. Mirrors `normalizeHebrew` in the ingest.
 */
function stripHebrewPointing(s: string): string {
  return s.replace(/[֑-ׇ]/g, "").replace(/\//g, "");
}

/**
 * Builds a LIKE prefix pattern, escaping the wildcards.
 *
 * Without this a query containing `%` matches every row in a 443,000-row table, and `_` matches
 * any character — user input reaching a LIKE pattern unescaped is a correctness bug before it
 * is anything else.
 */
function likePrefix(s: string): string {
  return `${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// --- Lexicon --------------------------------------------------------------------------------

/**
 * The Hebrew/Aramaic dictionary.
 *
 * `original_words.lemma` for the WLC is the OSIS lemma attribute verbatim — `b/2617 a` — which
 * is a Strong's number carrying its prefixed morphemes, not a headword. That is the right thing
 * to store and the wrong thing to show a reader. The headword comes from here, reached by
 * `strongs`, and `lemma` is left alone: it is the Greek's concordance key, and for the Hebrew it
 * is the morpheme analysis a researcher actually wants to be able to see.
 */
export interface LexiconEntry {
  /** `H2617a`. Always `H`-prefixed — Strong's Hebrew is one sequence covering Aramaic too. */
  key: string;
  strongsNum: number;
  /** The OSHB homonym letter, or null for the undifferentiated Strong's entry. */
  homonym: string | null;
  language: string;
  /** Pointed Hebrew/Aramaic headword. */
  headword: string;
  xlit: string;
  pos: string;
  pron: string;
  /** One- or two-word gloss. */
  gloss: string;
  /** Strong's fuller definition. Empty on homonym rows — see `provenance`. */
  meaning: string;
  usage: string;
  etymology: string;
  twot: string;
  bdb: string;
  /**
   * `strong` | `oshb` | `strong+oshb`.
   *
   * Load-bearing, not trivia. `oshb` means the OSHB lexical index distinguished this homonym and
   * Strong's did not, so `meaning`/`usage`/`etymology`/`pron` are empty *by design* rather than
   * missing: Strong's never drew the distinction, and copying its prose onto one side of a split
   * it did not make would be a false precision. Show the base entry alongside instead.
   */
  provenance: string;
}

export interface LexiconSource {
  code: string;
  name: string;
  license: string;
  /** CC BY 4.0 obliges this to travel to wherever an entry is displayed. */
  attribution: string;
  sourceUrl: string;
}

export interface GreekLexiconEntry {
  headword: string;
  gloss: string;
  definition: string;
}

/** Full Greek entry from the CC0 Dodson lexicon, matched by the corpus lemma. */
export function getGreekLexiconEntry(lemma: string): GreekLexiconEntry | null {
  const exact = prepared(
    `SELECT headword, gloss, definition FROM greek_lexicon
     WHERE headword = ? ORDER BY entry_key LIMIT 1`
  ).get(lemma) as GreekLexiconEntry | undefined;
  if (exact) return exact;
  const folded = stripGreekDiacritics(lemma);
  return (
    prepared(
      `SELECT headword, gloss, definition FROM greek_lexicon
       WHERE search_headword = ? ORDER BY entry_key LIMIT 1`
    ).get(folded) as GreekLexiconEntry | undefined
  ) ?? null;
}

/** Licence and attribution for the lexicon. Must be rendered wherever an entry is. */
export const getLexiconSources = cache((): LexiconSource[] =>
  prepared(
    `SELECT code, name, license, attribution, source_url AS sourceUrl
     FROM original_lexicon_sources ORDER BY source_id`
  ).all() as LexiconSource[]
);

/**
 * Licence and attribution for the Greek lexicon (Dodson, CC0). A separate accessor rather than
 * folding into `getLexiconSources`: that one reads `original_lexicon_sources`, which is a
 * different table for a reason stated in the schema (`greek_lexicon` has no natural key in
 * common with `original_lexicon`, so neither does its source-attribution table).
 */
export const getGreekLexiconSources = cache((): LexiconSource[] =>
  prepared(
    `SELECT code, name, license, attribution, source_url AS sourceUrl
     FROM greek_lexicon_sources ORDER BY source_id`
  ).all() as LexiconSource[]
);

const LEXICON_COLUMNS = `entry_key AS key, strongs_num AS strongsNum, homonym, language,
   headword, xlit, pos, pron, gloss, meaning, usage, etymology, twot, bdb, provenance`;

/**
 * Normalises a Strong's key onto the lexicon's key space: `A5020` and `5020` both give `H5020`.
 *
 * The `A` prefix on `original_words.strongs` is derived from an individual word's morphology
 * code, not from the dictionary — seven numbers in this corpus appear under both prefixes — so
 * it is folded away here. `G` is REJECTED rather than folded: Strong's Greek is a separate
 * sequence (G26 is *agapē*, H26 is *Abagtha*) and this lexicon holds no Greek, so accepting it
 * would answer a Greek question with a Hebrew entry.
 *
 * Distinct from `parseStrongsKey`, which normalises onto the *corpus's* key space and must keep
 * doing exactly what it does — it is what `getConcordanceSummary` matches `strongs` with.
 */
export function lexiconKey(raw: string): string | null {
  // Lower-case class, because the subject has already been lower-cased. An upper-case [HA]
  // here matches nothing and every lookup silently returns null.
  const m = /^[ha]?(\d{1,5})([a-z])?$/.exec(raw.trim().toLowerCase());
  if (!m) return null;
  return `H${Number(m[1])}${m[2] ?? ""}`;
}

/** One dictionary entry. Null when the key is not a Strong's number or has no entry. */
export function getLexiconEntry(rawKey: string): LexiconEntry | null {
  const key = lexiconKey(rawKey);
  if (key === null) return null;
  return (
    (prepared(`SELECT ${LEXICON_COLUMNS} FROM original_lexicon WHERE entry_key = ?`).get(key) as
      | LexiconEntry
      | undefined) ?? null
  );
}

/**
 * Entries for many keys at once, returned keyed by the *caller's* strings.
 *
 * For the interlinear, which has up to a few hundred words on screen and would otherwise issue
 * one query per word. The map is keyed by what the caller passed (`A5020`, `H430`) rather than
 * by the normalised key, so a caller holding `original_words.strongs` can look up with the value
 * it already has and never has to know about the A/H fold.
 */
export function getLexiconEntries(rawKeys: readonly string[]): Map<string, LexiconEntry> {
  const wanted = new Map<string, string[]>();
  for (const raw of rawKeys) {
    const key = lexiconKey(raw);
    if (key === null) continue;
    const callers = wanted.get(key);
    if (callers) callers.push(raw);
    else wanted.set(key, [raw]);
  }
  const out = new Map<string, LexiconEntry>();
  if (wanted.size === 0) return out;

  // Chunked: SQLite's default SQLITE_MAX_VARIABLE_NUMBER is 999 on older builds, and a whole
  // chapter of Hebrew can exceed that.
  const keys = [...wanted.keys()];
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const rows = prepared(
      `SELECT ${LEXICON_COLUMNS} FROM original_lexicon
       WHERE entry_key IN (${chunk.map(() => "?").join(",")})`
    ).all(...chunk) as LexiconEntry[];
    for (const row of rows) {
      for (const caller of wanted.get(row.key) ?? []) out.set(caller, row);
    }
  }
  return out;
}

/**
 * A member of a Strong's homonym family, with how often the corpus actually uses it.
 *
 * `count` is occurrences in `original_words`, and it can legitimately be 0: the lexicon
 * distinguishes homonyms the WLC morphology never cites separately. A member with no
 * occurrences is still shown — it is why the number is ambiguous — but it is not a link to a
 * concordance page that would be empty.
 */
export interface StrongsFamilyMember {
  key: string;
  homonym: string | null;
  headword: string;
  xlit: string;
  gloss: string;
  language: string;
  count: number;
}

/**
 * Every dictionary entry sharing a Strong's NUMBER, base entry first then homonyms in order.
 *
 * This is the disambiguation set, and it is deliberately not a merge. H2617a is *ḥesed*
 * "goodness, kindness" and H2617b is *ḥesed* "shame, reproach" — the same consonants, opposite
 * meanings, different BDB articles. They share a number only because Strong's did not separate
 * them. Concatenating their occurrences into one concordance entry would produce a word that
 * means both, which no Hebrew word does, and the reader would have no way to see the seam.
 */
export function getStrongsFamily(rawKey: string): StrongsFamilyMember[] {
  const key = lexiconKey(rawKey);
  if (key === null) return [];
  const num = Number(/^H(\d+)/.exec(key)?.[1]);
  if (!Number.isFinite(num)) return [];

  // The occurrence count joins back on the CORPUS key space, where the prefix may be 'A'. The
  // comparison is written as equality against two constructed keys rather than
  // `SUBSTR(w.strongs, 2) = SUBSTR(l.entry_key, 2)`: applying a function to the indexed column
  // makes `original_words_strong_idx` unusable and turns each member into a full scan of
  // 443,000 rows. Equality against an expression keeps the index.
  return prepared(
    `SELECT l.entry_key AS key, l.homonym, l.headword, l.xlit, l.gloss, l.language,
            (SELECT COUNT(*) FROM original_words w
              WHERE w.strongs IN ('H' || SUBSTR(l.entry_key, 2), 'A' || SUBSTR(l.entry_key, 2)))
              AS count
     FROM original_lexicon l
     WHERE l.strongs_num = ?
     ORDER BY l.homonym IS NOT NULL, l.homonym`
  ).all(num) as StrongsFamilyMember[];
}

/**
 * What a typed Strong's number should resolve to.
 *
 * The defect this exists for: a reader copies `H2617` out of a printed concordance, but the WLC
 * morphology only ever cites `H2617a` and `H2617b`, so an exact match found nothing and the page
 * 404'd. The fix is NOT to make `H2617` silently mean "both" — see `getStrongsFamily`. It is to
 * answer "that number is two different words; which did you mean?".
 *
 * - `exact`   — the key occurs in the corpus as typed. Behaviour is unchanged for these, which
 *               is the whole point: `parseStrongsKey` and `getConcordanceSummary` still do
 *               precisely what they did, and every existing link keeps working.
 * - `family`  — the key itself occurs nowhere, but sibling entries sharing its number do. The
 *               caller renders a disambiguation. `members` carries headword, gloss and count so
 *               the reader can tell them apart without a second round trip.
 * - `none`    — not a Strong's key, or nothing in the corpus or the lexicon.
 */
export type ConcordanceResolution =
  | { kind: "exact"; key: string; entry: LexiconEntry | null }
  | { kind: "family"; base: string; entry: LexiconEntry | null; members: StrongsFamilyMember[] }
  | { kind: "none" };

export function resolveConcordanceKey(rawKey: string): ConcordanceResolution {
  const corpusKey = parseStrongsKey(rawKey);
  if (corpusKey === null) return { kind: "none" };

  const hit = prepared(
    `SELECT 1 AS present FROM original_words WHERE strongs = ? LIMIT 1`
  ).get(corpusKey) as { present: number } | undefined;
  if (hit) return { kind: "exact", key: corpusKey, entry: getLexiconEntry(corpusKey) };

  // Exact miss. Try the family — but only its members that the corpus actually attests, since
  // offering a reader a choice that leads to an empty concordance is not a disambiguation.
  const members = getStrongsFamily(corpusKey).filter((m) => m.count > 0);
  if (members.length === 0) return { kind: "none" };

  const base = lexiconKey(corpusKey) ?? corpusKey;
  return {
    kind: "family",
    base,
    // The undifferentiated Strong's entry, when there is one. It is what the reader's printed
    // concordance was quoting, so showing it above the split is what makes the split legible.
    entry: getLexiconEntry(base.replace(/[a-z]$/, "")),
    members,
  };
}
