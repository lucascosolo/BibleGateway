import "server-only";

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import type { VerseId, VerseRange } from "@/lib/refs/verse-id";
import { BOOK_FACTOR, CHAPTER_FACTOR, bookOf, chapterOf } from "@/lib/refs/verse-id";

/**
 * Read-only handle on the audio artifact: `data/audio.db` plus `data/audio/<edition>/*.m4a`.
 *
 * A THIRD database, on purpose, and a separate build. `bible.db` is rebuilt in four minutes
 * from text sources; the audio artifact is the output of a forced-alignment run over some 260
 * hours of speech and takes most of a day. Chaining them would mean either never rebuilding
 * the corpus or re-aligning every recording each time a gloss is corrected. They share nothing
 * except the canonical address space — every timing row here is keyed by `verse_id` or by
 * `original_words.word_id`, so a chapter's audio and a chapter's text meet on the id and
 * nowhere else. See `packages/audio/README.md` and `docs/plans/2026-09-04-audio.md`.
 *
 * FEATURE-DETECTED. A deployment without the artifact simply has no player: every accessor
 * below returns empty rather than throwing, so a fresh checkout, a test run, or the corpus
 * being rebuilt underneath the app all render the reader exactly as before.
 */

const DB_PATH =
  process.env.AUDIO_DB_PATH ?? path.resolve(process.cwd(), "..", "..", "data", "audio.db");

/** Where the chapter files live; served by `app/audio/[...path]/route.ts`. */
export const AUDIO_FILES_DIR =
  process.env.AUDIO_FILES_DIR ?? path.resolve(process.cwd(), "..", "..", "data", "audio");

let instance: Database.Database | null | undefined;

function db(): Database.Database | null {
  if (instance !== undefined) return instance;
  if (!fs.existsSync(DB_PATH)) {
    instance = null;
    return null;
  }
  instance = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  instance.pragma("query_only = true");
  instance.pragma("mmap_size = 67108864");
  return instance;
}

const statements = new Map<string, Database.Statement>();

function prepared(sql: string): Database.Statement | null {
  const handle = db();
  if (!handle) return null;
  let stmt = statements.get(sql);
  if (!stmt) {
    stmt = handle.prepare(sql);
    statements.set(sql, stmt);
  }
  return stmt;
}

export function hasAudio(): boolean {
  return db() !== null;
}

let buildId: string | null = null;

/** Content-derived id of the audio artifact, for cache-busting file URLs. */
export function getAudioBuildId(): string {
  if (buildId) return buildId;
  const row = prepared(`SELECT value FROM audio_meta WHERE key = 'build_id'`)?.get() as
    | { value: string }
    | undefined;
  buildId = row?.value ?? "dev";
  return buildId;
}

export interface AudioEdition {
  editionId: number;
  code: string;
  /** The translation this recording reads, or null for an original-language reading. */
  translationCode: string | null;
  language: string;
  name: string;
  reader: string;
  license: string;
  attribution: string;
  sourceUrl: string;
  pronunciationNote: string | null;
}

export function getAudioEditions(): AudioEdition[] {
  return (
    (prepared(
      `SELECT edition_id AS editionId, code, translation_code AS translationCode, language, name,
              reader, license, attribution, source_url AS sourceUrl,
              pronunciation_note AS pronunciationNote
       FROM audio_editions ORDER BY edition_id`,
    )?.all() as AudioEdition[] | undefined) ?? []
  );
}

export interface VerseTiming {
  verseId: VerseId;
  startMs: number;
  endMs: number;
}

/** One chapter file of one edition, with where each verse falls in it. */
export interface ChapterAudio {
  editionCode: string;
  bookId: number;
  chapter: number;
  /** Absolute app URL of the chapter file, versioned by the audio build id. */
  url: string;
  durationMs: number;
  verses: VerseTiming[];
}

/** A slice of a chapter file in which a human reader says one original-language word. */
export interface WordClip {
  editionCode: string;
  url: string;
  startMs: number;
  endMs: number;
}

/** The audio available for what the reader is showing: per chapter, per edition. */
export interface PassageAudio {
  editions: AudioEdition[];
  chapters: {
    bookId: number;
    chapter: number;
    /** Keyed by edition code. An edition with no recording of this chapter is absent. */
    byEdition: Record<string, ChapterAudio>;
  }[];
}

function fileUrl(relative: string): string {
  return `/audio/${relative}?v=${getAudioBuildId()}`;
}

export function getChapterAudio(
  editionCode: string,
  bookId: number,
  chapter: number,
): ChapterAudio | null {
  const row = prepared(
    `SELECT c.file, c.duration_ms AS durationMs
     FROM audio_chapters c JOIN audio_editions e ON e.edition_id = c.edition_id
     WHERE e.code = ? AND c.book_id = ? AND c.chapter = ?`,
  )?.get(editionCode, bookId, chapter) as { file: string; durationMs: number } | undefined;
  if (!row) return null;
  // Arithmetic rather than `toVerseId`, which rightly refuses verse 0: this is a BETWEEN bound
  // over the chapter's whole verse block, not an address.
  const lo = bookId * BOOK_FACTOR + chapter * CHAPTER_FACTOR;
  const verses = prepared(
    `SELECT v.verse_id AS verseId, v.start_ms AS startMs, v.end_ms AS endMs
     FROM audio_verses v JOIN audio_editions e ON e.edition_id = v.edition_id
     WHERE e.code = ? AND v.verse_id BETWEEN ? AND ?
     ORDER BY v.verse_id`,
  )!.all(editionCode, lo, lo + 999) as VerseTiming[];
  return {
    editionCode,
    bookId,
    chapter,
    url: fileUrl(row.file),
    durationMs: row.durationMs,
    verses,
  };
}

/**
 * Every chapter the range touches, for every edition. The reader renders at most three
 * chapters, so this is at most a handful of indexed lookups; the range's own endpoints are
 * enough to enumerate chapters because a chapter is entirely inside one book.
 */
export function getPassageAudio(range: VerseRange): PassageAudio | null {
  if (!hasAudio()) return null;
  const editions = getAudioEditions();
  const chapters: PassageAudio["chapters"] = [];
  const startBook = bookOf(range.start) as number;
  const endBook = bookOf(range.end) as number;
  for (let bookId = startBook; bookId <= endBook; bookId++) {
    const from = bookId === startBook ? chapterOf(range.start) : 1;
    const to = bookId === endBook ? chapterOf(range.end) : 999;
    for (let chapter = from; chapter <= to; chapter++) {
      const byEdition: Record<string, ChapterAudio> = {};
      for (const edition of editions) {
        const audio = getChapterAudio(edition.code, bookId, chapter);
        if (audio) byEdition[edition.code] = audio;
      }
      // A chapter no edition recorded is still listed, so the player can say "no audio here"
      // for exactly this chapter rather than for the page.
      chapters.push({ bookId, chapter, byEdition });
      if (chapters.length > 8) return { editions, chapters }; // never enumerate a whole book
    }
  }
  return { editions, chapters };
}

/**
 * Word-level clips for the interlinear's speaker buttons, keyed by `original_words.word_id`.
 *
 * Only the Hebrew edition has word timings (the aligner emits them for every word it places;
 * English words are not shown in the interlinear, so theirs are never stored). Returns an
 * empty map when there is no audio at all, which the interlinear renders as no buttons.
 */
export function getWordClips(range: VerseRange): Map<number, WordClip> {
  const out = new Map<number, WordClip>();
  const rows = prepared(
    `SELECT w.word_id AS wordId, e.code AS editionCode, c.file, w.start_ms AS startMs, w.end_ms AS endMs
     FROM audio_words w
     JOIN audio_editions e ON e.edition_id = w.edition_id
     JOIN audio_chapters c ON c.edition_id = w.edition_id
       AND c.book_id = w.verse_id / 1000000 AND c.chapter = (w.verse_id / 1000) % 1000
     WHERE w.verse_id BETWEEN ? AND ?`,
  )?.all(range.start, range.end) as
    | { wordId: number; editionCode: string; file: string; startMs: number; endMs: number }[]
    | undefined;
  for (const r of rows ?? []) {
    out.set(r.wordId, {
      editionCode: r.editionCode,
      url: fileUrl(r.file),
      startMs: r.startMs,
      endMs: r.endMs,
    });
  }
  return out;
}

/** Chapter counts per edition, for the corpus facts / API surface. */
export function getAudioCoverage(): { code: string; chapters: number; verses: number }[] {
  return (
    (prepared(
      `SELECT e.code,
              (SELECT COUNT(*) FROM audio_chapters c WHERE c.edition_id = e.edition_id) AS chapters,
              (SELECT COUNT(*) FROM audio_verses v WHERE v.edition_id = e.edition_id) AS verses
       FROM audio_editions e ORDER BY e.edition_id`,
    )?.all() as { code: string; chapters: number; verses: number }[] | undefined) ?? []
  );
}
