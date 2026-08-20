// Drizzle ORM schema for the Bible ingest corpus.
//
// Mirrors ARCHITECTURE.md §3 exactly in table/column names. One deviation from the
// doc: SQLite (better-sqlite3) instead of Postgres, since the corpus is immutable and
// ships as a file. Only the columns needed by the ingest pipeline (§3.1, §3.4) are
// defined here — the rest of the schema (annotations, manuscripts, timeline, etc.)
// belongs to the app package and is out of scope for ingest.
//
// Postgres -> SQLite type mapping used throughout:
//   SMALLINT/INTEGER/BIGSERIAL -> integer
//   TEXT                       -> text
//   TEXT[]                     -> text (JSON-encoded array)
//   JSONB                      -> text (JSON-encoded)
//   BOOLEAN                    -> integer (0/1)
//   REAL                       -> real

import { sqliteTable, integer, text, real, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// --- 3.1 Canonical text -----------------------------------------------------------

export const books = sqliteTable("books", {
  bookId: integer("book_id").primaryKey(),
  osisId: text("osis_id").notNull().unique(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  testament: text("testament").notNull(), // 'OT' | 'NT' | 'DC'
  canonSection: text("canon_section"),
  genre: text("genre").notNull(), // JSON array, e.g. '["law","narrative"]'
  chapterCount: integer("chapter_count").notNull(),
});

export const verses = sqliteTable(
  "verses",
  {
    verseId: integer("verse_id").primaryKey(), // BBCCCVVV
    bookId: integer("book_id").notNull().references(() => books.bookId),
    chapter: integer("chapter").notNull(),
    verse: integer("verse").notNull(),
    osisRef: text("osis_ref").notNull().unique(), // 'John.3.16'
    canonOrder: integer("canon_order").notNull(),
  },
  (t) => ({
    bookIdx: index("verses_book_id_idx").on(t.bookId),
  })
);

export const translations = sqliteTable("translations", {
  translationId: integer("translation_id").primaryKey(),
  code: text("code").notNull().unique(), // 'WEB','BSB'
  name: text("name").notNull(),
  language: text("language").notNull(),
  license: text("license").notNull(),
  isLicensed: integer("is_licensed").notNull().default(1), // boolean 0/1
  copyrightNotice: text("copyright_notice").notNull(),
  versification: text("versification").notNull().default("org"),
  /** 'all' | 'OT' | 'NT' — which books this text covers. */
  scope: text("scope").notNull().default("all"),
  scopeNote: text("scope_note").notNull().default(""),
});

/**
 * Which books each translation actually prints.
 *
 * Separate from `verse_omissions` on purpose, and the separation is the point: an omission is
 * a claim about the manuscript tradition ("the earliest Greek copies do not contain this
 * verse"), while this is a claim about the edition ("this is a translation of the Hebrew
 * Bible"). They were once the same table, and the home page consequently announced 7,992
 * verses "some Bibles leave out" when the true number is twelve.
 */
export const translationBooks = sqliteTable(
  "translation_books",
  {
    translationId: integer("translation_id")
      .notNull()
      .references(() => translations.translationId),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.bookId),
    /** 'printed' | 'out_of_scope'. A claimed-but-empty book is a build failure, not a status. */
    status: text("status").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.translationId, t.bookId] }),
  })
);

export const verseTexts = sqliteTable(
  "verse_texts",
  {
    translationId: integer("translation_id")
      .notNull()
      .references(() => translations.translationId),
    verseId: integer("verse_id")
      .notNull()
      .references(() => verses.verseId),
    text: text("text").notNull(), // plain, NFC-normalized, no markup
    formatting: text("formatting"), // JSON sidecar (poetry indents, red-letter, etc.)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.translationId, t.verseId] }),
    rangeIdx: index("verse_texts_translation_verse_idx").on(t.translationId, t.verseId),
  })
);

// --- 3.4 Cross-references ----------------------------------------------------------

export const crossReferences = sqliteTable(
  "cross_references",
  {
    xrefId: integer("xref_id").primaryKey({ autoIncrement: true }),
    fromVerseId: integer("from_verse_id")
      .notNull()
      .references(() => verses.verseId),
    toStartVerse: integer("to_start_verse")
      .notNull()
      .references(() => verses.verseId),
    toEndVerse: integer("to_end_verse")
      .notNull()
      .references(() => verses.verseId),
    votes: integer("votes").notNull().default(0),
    source: text("source").notNull(), // 'openbible' | 'tsk' | 'curated'
    relation: text("relation"), // nullable for now
  },
  (t) => ({
    fromIdx: index("cross_references_from_verse_id_idx").on(t.fromVerseId),
    toIdx: index("cross_references_to_range_idx").on(t.toStartVerse, t.toEndVerse),
  })
);

// Materialized (build-time-computed) heat table — SQLite has no matviews, so this is
// a real table populated once during ingest.
export const verseReferenceHeat = sqliteTable(
  "verse_reference_heat",
  {
    verseId: integer("verse_id")
      .primaryKey()
      .references(() => verses.verseId),
    inboundCount: integer("inbound_count").notNull(),
    weightedScore: integer("weighted_score").notNull(),
    heatBucket: integer("heat_bucket").notNull(), // 1-5, via NTILE(5) over inbound_count
  }
);

// --- Full-text search (Derash) ------------------------------------------------------
//
// verse_texts_fts (FTS5 virtual table) is intentionally NOT declared here. drizzle-orm's
// sqlite-core has no builder for `CREATE VIRTUAL TABLE ... USING fts5(...)` — it isn't a
// table with a fixed column/type schema in the way `sqliteTable` models one, it's a module
// with its own storage and query syntax (MATCH, bm25(), offsets()). Faking it as a normal
// `sqliteTable` would type-check but describe something that doesn't match what actually
// exists on disk. It is created and populated with raw `sqlite.exec()`/`INSERT` directly in
// ingest.ts, next to the rest of the DDL; that file is the source of truth for its shape.
