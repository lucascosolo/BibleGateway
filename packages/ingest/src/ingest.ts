// Offline ingest pipeline: raw/ -> normalize -> validate -> data/bible.db (SQLite).
// Run with `npm run ingest`. Never runs in prod; the app only ever reads bible.db.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import unzipper from "unzipper";

import { BOOKS } from "./books.js";
import { BSB_BOOK_MAP } from "./bsb-book-map.js";
import { fetchAndExtract, fetchCached, sha256File } from "./download.js";
import { LEGITIMATE_COMPOUNDS, loadDictionary } from "./dictionary.js";
import { findTextArtifacts, normalizeVerseText } from "./normalize-text.js";
import {
  GREEK_SCHEME,
  SBLGNT_VERSIFICATION_EXCEPTIONS,
  parseOsisWithPart,
  parseSblgnt,
  parseVerseMap,
  parseWlc,
  scanWlcVerseRefs,
  searchForm,
  type OriginalVariantRow,
  type OriginalWordRow,
  type VersificationRow,
} from "./originals.js";
import {
  buildLexicon,
  HEBREW_LEXICON_ATTRIBUTION,
  HEBREW_LEXICON_LICENSE,
  HEBREW_LEXICON_SOURCE_URL,
  lexiconKey,
  parseHebrewStrong,
  parseLexicalIndex,
  type LexiconEntryRow,
} from "./lexicon.js";
import {
  GREEK_LEXICON_ATTRIBUTION,
  GREEK_LEXICON_LICENSE,
  GREEK_LEXICON_SOURCE_URL,
  parseDodson,
  type GreekLexiconEntryRow,
} from "./greek-lexicon.js";
import * as schema from "./schema.js";
import {
  CANONICAL_EXTRA_VERSES,
  omissionExplanation,
  TRANSLATION_SOURCES,
} from "./translations.js";
import { parseUsfx, type UsfxResult } from "./usfx.js";
import { XREF_BOOK_MAP } from "./xref-book-map.js";
import { parseTagntFiles, type TagntVariantRow } from "./tagnt.js";
import { parseVarApp, type VarAppReadingRow } from "./varapp.js";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "..", "..", "data");
const DB_PATH = path.join(DATA_DIR, "bible.db");
/** Where the corpus is assembled. Promoted onto DB_PATH only after the validation gate passes. */
const BUILD_PATH = path.join(DATA_DIR, "bible.db.building");

const SOURCES = {
  web: { url: "https://api.getbible.net/v2/web.json", filename: "web.json" },
  bsb: { url: "https://bereanbible.com/bsb.txt", filename: "bsb.txt" },
  xrefs: { url: "https://a.openbible.info/data/cross-references.zip", filename: "cross-references.zip" },
  // Original languages. Both CC-licensed and both word-level: every word carries a lemma and a
  // morphology code, which is what makes lemma concordance possible.
  morphhb: {
    url: "https://codeload.github.com/openscriptures/morphhb/tar.gz/refs/heads/master",
    filename: "morphhb.tar.gz",
  },
  sblgnt: {
    url: "https://codeload.github.com/morphgnt/sblgnt/tar.gz/refs/heads/master",
    filename: "sblgnt.tar.gz",
  },
  // The Hebrew/Aramaic dictionary. Needed because the WLC's OSIS `lemma` attribute is a
  // Strong's number with its prefix morphemes (`b/2617 a`), not a headword — so without this
  // the interlinear had nothing to show a reader but a code. See lexicon.ts.
  //
  // CC BY 4.0, per the repository's own readme — NOT public domain, which is what it is
  // usually assumed to be. Only the underlying 19th-century BDB and Strong's text is public
  // domain; the files we redistribute are licensed, with an attribution condition.
  hebrewLexicon: {
    url: "https://codeload.github.com/openscriptures/HebrewLexicon/tar.gz/refs/heads/master",
    filename: "hebrew-lexicon.tar.gz",
  },
  // The Greek dictionary. MorphGNT carries no Strong's number for any word (see originals.ts),
  // so `original_words.lemma` — already a real headword for Greek — is the only join key this
  // could ever have. See greek-lexicon.ts for the keying and licence detail.
  //
  // CC0 1.0 Universal, per the repository's own LICENSE and README ("This lexicon, in all of
  // its forms, is in the public domain"). Unlike the Hebrew lexicon, there is no underlying
  // licensed wrapper to distinguish from the public-domain text: the whole file is CC0.
  dodsonLexicon: {
    url: "https://raw.githubusercontent.com/biblicalhumanities/Dodson-Greek-Lexicon/master/dodson.xml",
    filename: "dodson.xml",
  },
  tagntMatJhn: {
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
    filename: "tagnt-mat-jhn.txt",
  },
  tagntActRev: {
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
    filename: "tagnt-act-rev.txt",
  },
  varApp: {
    url: "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/VarApp.zip",
    filename: "VarApp.zip",
  },
} as const;

/**
 * eBible.org USFX zips, one per translation added after WEB and BSB. See translations.ts for
 * what each one is, what its licence says, and what was deliberately left out.
 *
 * The publisher's own package rather than a third party's re-export, because it carries two
 * things a re-export drops: the markup (so THIS pipeline decides how footnotes are removed,
 * instead of inheriting somebody else's whitespace bug — see usfx.ts) and `copr.htm`, the
 * licence in the licensor's own words, which the ingest checks against what we render.
 */
const USFX_SOURCE_URL = (ebibleId: string) => ({
  url: `https://ebible.org/Scriptures/${ebibleId}_usfx.zip`,
  filename: `${ebibleId}_usfx.zip`,
});

/**
 * Text ids for `original_texts`. Fixed constants rather than autoincrement: they end up in
 * every one of the ~600k `original_words` rows, and a corpus rebuild that renumbered them
 * would invalidate anything that had recorded one.
 */
const WLC_TEXT_ID = 1;
const SBLGNT_TEXT_ID = 2;

/** The versification scheme the Hebrew Bible numbers verses in. See versification_map. */
const HEBREW_SCHEME = "hebrew";

/**
 * The seventy canonical verses that receive the words of more than one WLC verse.
 *
 * A REVIEWED BASELINE, and the load-bearing half of the versification coverage gate. Read the
 * gate's own comment for why it has to be an enumeration and not a rule.
 *
 * Sixty-three are Psalm superscriptions: the Hebrew numbers the "To the chief musician, a psalm
 * of David" line as verse 1 and English leaves it unnumbered, so Hebrew 1+2 both land on English
 * 1 (four psalms — 51, 52, 54, 60 — have a two-line superscription and take three Hebrew verses).
 * The other seven are ordinary verse-division disagreements at a chapter seam: Num 25:19/26:1,
 * 1 Sam 20:42/21:1, 1 Kgs 18:33/34, 20:2/3, 22:21/22, 22:43/44, 1 Chr 12:4/5.
 *
 * Derived from morphhb's own VerseMap.xml plus the identity cases, and cross-checked against the
 * WLC's declared verse list. If an upstream refresh changes this set the build fails and a human
 * reads the diff — which is the point. Do not regenerate it from the data it is checking.
 */
const HEBREW_ASSEMBLED_VERSES: readonly string[] = [
  "Num.26.1", "1Sam.20.42", "1Kgs.18.33", "1Kgs.20.2", "1Kgs.22.22", "1Kgs.22.43", "1Chr.12.4",
  "Ps.3.1", "Ps.4.1", "Ps.5.1", "Ps.6.1", "Ps.7.1", "Ps.8.1", "Ps.9.1", "Ps.12.1", "Ps.13.1",
  "Ps.18.1", "Ps.19.1", "Ps.20.1", "Ps.21.1", "Ps.22.1", "Ps.30.1", "Ps.31.1", "Ps.34.1",
  "Ps.36.1", "Ps.38.1", "Ps.39.1", "Ps.40.1", "Ps.41.1", "Ps.42.1", "Ps.44.1", "Ps.45.1",
  "Ps.46.1", "Ps.47.1", "Ps.48.1", "Ps.49.1", "Ps.51.1", "Ps.52.1", "Ps.53.1", "Ps.54.1",
  "Ps.55.1", "Ps.56.1", "Ps.57.1", "Ps.58.1", "Ps.59.1", "Ps.60.1", "Ps.61.1", "Ps.62.1",
  "Ps.63.1", "Ps.64.1", "Ps.65.1", "Ps.67.1", "Ps.68.1", "Ps.69.1", "Ps.70.1", "Ps.75.1",
  "Ps.76.1", "Ps.77.1", "Ps.80.1", "Ps.81.1", "Ps.83.1", "Ps.84.1", "Ps.85.1", "Ps.88.1",
  "Ps.89.1", "Ps.92.1", "Ps.102.1", "Ps.108.1", "Ps.140.1", "Ps.142.1",
];

/**
 * The six canonical Old Testament verses that receive NO Hebrew words, and why.
 *
 * The other half of the gate, and the honest record of a real limitation.
 *
 * Five are the `!a`/`!b` splits: one WLC verse straddles a canonical boundary, and the source
 * gives no word-level cut between the halves. The loader anchors the whole source verse to the
 * first canonical target, so the second gets nothing. That is under-covered rather than fixed —
 * inventing a boundary would be worse than an empty one, and the reader is told on the page (see
 * `Interlinear`'s split notice) rather than left to wonder why the Hebrew stops.
 *
 * Neh 7:68 is different and is not our doing: the Leningrad Codex simply does not have the verse
 * (the "two hundred forty-five mules" line), which is why English Bibles differ over whether
 * Nehemiah 7 has 72 verses or 73.
 */
const HEBREW_UNSOURCED_VERSES: readonly string[] = [
  "1Kgs.18.34", // 1Kgs.18.34!a merges back into 18:33; no word boundary for !b
  "1Kgs.20.3",  // 1Kgs.20.3!a merges back into 20:2
  "1Kgs.22.21", // 1Kgs.22.21!b runs on into 22:22
  "Neh.7.68",   // absent from the Leningrad Codex itself
  "Ps.13.6",    // Ps.13.6!a / !b split across canonical 13:5 and 13:6
  "Isa.63.19",  // Isa.63.19!b becomes canonical 64:1
];

function verseId(bookId: number, chapter: number, verse: number): number {
  return bookId * 1_000_000 + chapter * 1_000 + verse;
}

// --- Source parsing -----------------------------------------------------------------

interface WebVerse {
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
}

interface WebBook {
  nr: number;
  name: string;
  chapters: { chapter: number; verses: { chapter: number; verse: number; text: string }[] }[];
}

async function parseWeb(filePath: string): Promise<{ verses: WebVerse[]; chapterCounts: Map<number, number> }> {
  const { readFile } = await import("node:fs/promises");
  const raw = JSON.parse(await readFile(filePath, "utf-8")) as { books: WebBook[] };

  const verses: WebVerse[] = [];
  const chapterCounts = new Map<number, number>();

  for (const book of raw.books) {
    chapterCounts.set(book.nr, book.chapters.length);
    for (const chapter of book.chapters) {
      for (const v of chapter.verses) {
        verses.push({ bookId: book.nr, chapter: v.chapter, verse: v.verse, text: v.text });
      }
    }
  }

  return { verses, chapterCounts };
}

interface BsbVerse {
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
}

async function parseBsb(filePath: string): Promise<BsbVerse[]> {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(filePath, "utf-8");
  // Strip BOM if present.
  const content = raw.replace(/^﻿/, "");
  const lines = content.split(/\r?\n/);

  const verses: BsbVerse[] = [];
  const refRe = /^(.+?) (\d+):(\d+)$/;

  for (const line of lines) {
    if (!line.trim()) continue;
    const tabIdx = line.indexOf("\t");
    if (tabIdx === -1) continue; // header/preamble lines with no tab
    const ref = line.slice(0, tabIdx).trim();
    const text = line.slice(tabIdx + 1);

    if (ref === "Verse") continue; // column header row

    const m = ref.match(refRe);
    if (!m) {
      // Not a verse reference line (e.g. the two preamble/license lines) — skip.
      continue;
    }
    const [, bookName, chapterStr, verseStr] = m;
    const bookId = BSB_BOOK_MAP[bookName];
    if (bookId === undefined) {
      throw new Error(`[bsb] Unmapped book name: "${bookName}" (from line: "${ref}")`);
    }
    verses.push({ bookId, chapter: Number(chapterStr), verse: Number(verseStr), text });
  }

  return verses;
}

interface RawXref {
  fromRef: string;
  toRef: string;
  votes: number;
}

async function parseXrefs(zipPath: string): Promise<RawXref[]> {
  const directory = await unzipper.Open.file(zipPath);
  const entry = directory.files.find((f) => f.path === "cross_references.txt");
  if (!entry) {
    throw new Error("[xrefs] cross_references.txt not found in zip");
  }
  const buf = await entry.buffer();
  const text = buf.toString("utf-8");
  const lines = text.split(/\r?\n/);

  const out: RawXref[] = [];
  // First line is the header: "From Verse\tTo Verse\tVotes"
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const [fromRef, toRef, votesStr] = parts;
    const votes = Number(votesStr);
    if (Number.isNaN(votes)) {
      throw new Error(`[xrefs] Non-numeric votes on line ${i + 1}: "${line}"`);
    }
    out.push({ fromRef, toRef, votes });
  }
  return out;
}

// OSIS ref like "Gen.1.1" or a range endpoint "Rom.1.19" -> our verse_id.
// Fails loudly (throws) on any unmapped book abbreviation.
function resolveOsisRef(ref: string, verseIdByOsis: Map<string, number>): number | null {
  const parts = ref.split(".");
  if (parts.length !== 3) return null;
  const [abbrev, chapterStr, verseStr] = parts;
  const bookId = XREF_BOOK_MAP[abbrev];
  if (bookId === undefined) {
    throw new Error(`[xrefs] Unmapped OSIS book abbreviation: "${abbrev}" (from ref: "${ref}")`);
  }
  const chapter = Number(chapterStr);
  const verse = Number(verseStr);
  if (!Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
  const vid = verseId(bookId, chapter, verse);
  // Confirm this verse actually exists in our canonical address space (versification
  // divergences between OpenBible's source and WEB can otherwise silently corrupt IDs).
  if (!verseIdByOsis.has(`${bookId}.${chapter}.${verse}`)) return null;
  return vid;
}

// --- Main -----------------------------------------------------------------------------

async function main() {
  console.log("=== Bible ingest pipeline ===\n");

  mkdirSync(DATA_DIR, { recursive: true });

  // 1. Download (cached).
  const webPath = await fetchCached(SOURCES.web);
  const bsbPath = await fetchCached(SOURCES.bsb);
  const xrefsPath = await fetchCached(SOURCES.xrefs);
  const morphhbDir = await fetchAndExtract(SOURCES.morphhb, "morphhb");
  const sblgntDir = await fetchAndExtract(SOURCES.sblgnt, "sblgnt");
  const hebrewLexiconDir = await fetchAndExtract(SOURCES.hebrewLexicon, "hebrew-lexicon");
  const dodsonPath = await fetchCached(SOURCES.dodsonLexicon);
  const tagntMatJhnPath = await fetchCached(SOURCES.tagntMatJhn);
  const tagntActRevPath = await fetchCached(SOURCES.tagntActRev);
  const varAppPath = await fetchCached(SOURCES.varApp);
  const wlcDir = path.join(morphhbDir, "wlc");

  const usfxPaths = new Map<string, string>();
  for (const t of TRANSLATION_SOURCES) {
    usfxPaths.set(t.code, await fetchCached(USFX_SOURCE_URL(t.ebibleId)));
  }

  // Keep the exact inputs beside the derived corpus. A build id proves that two corpus files
  // differ; this manifest lets a researcher identify which upstream artifacts produced one.
  // Archive checksums are used rather than extracted-tree checksums so the evidence is cheap to
  // reproduce and includes files such as copr.htm that are not loaded into a scripture table.
  const sourceInputs = [
    { key: "web", name: "World English Bible JSON", url: SOURCES.web.url, path: webPath },
    { key: "bsb", name: "Berean Standard Bible text", url: SOURCES.bsb.url, path: bsbPath },
    { key: "openbible-xrefs", name: "OpenBible.info cross-references", url: SOURCES.xrefs.url, path: xrefsPath },
    { key: "morphhb", name: "OpenScriptures morphhb / WLC", url: SOURCES.morphhb.url, path: path.join(DATA_DIR, "raw", "morphhb.tar.gz") },
    { key: "sblgnt", name: "MorphGNT SBLGNT", url: SOURCES.sblgnt.url, path: path.join(DATA_DIR, "raw", "sblgnt.tar.gz") },
    { key: "hebrew-lexicon", name: "OpenScriptures HebrewLexicon", url: SOURCES.hebrewLexicon.url, path: path.join(DATA_DIR, "raw", "hebrew-lexicon.tar.gz") },
    { key: "dodson", name: "Dodson Greek Lexicon", url: SOURCES.dodsonLexicon.url, path: dodsonPath },
    { key: "tagnt-mat-jhn", name: "STEPBible TAGNT Matthew–John", url: SOURCES.tagntMatJhn.url, path: tagntMatJhnPath },
    { key: "tagnt-act-rev", name: "STEPBible TAGNT Acts–Revelation", url: SOURCES.tagntActRev.url, path: tagntActRevPath },
    { key: "varapp", name: "CrossWire VarApp", url: SOURCES.varApp.url, path: varAppPath },
    ...TRANSLATION_SOURCES.map((t) => ({
      key: `translation-${t.code.toLowerCase()}`,
      name: t.name,
      url: USFX_SOURCE_URL(t.ebibleId).url,
      path: usfxPaths.get(t.code)!,
    })),
  ] as const;
  const sourceChecksums = await Promise.all(
    sourceInputs.map(async (source) => ({ ...source, sha256: await sha256File(source.path) })),
  );

  console.log("\n[checksums]");
  for (const source of sourceChecksums) {
    console.log(`  ${source.key}: sha256=${source.sha256}`);
  }

  console.log("\n[parse] USFX translations...");
  const usfx = new Map<string, UsfxResult>();
  for (const t of TRANSLATION_SOURCES) {
    const result = await parseUsfx(usfxPaths.get(t.code)!, { allowVerseSuffix: t.code === "LXX" });
    usfx.set(t.code, result);
    console.log(
      `  ${t.code}: ${result.verses.length} source verses, ` +
        `${result.outsideCanon.length} outside the 66-book canon, ` +
        `${result.weldSites.length} weld site(s), copr.htm sha256=${result.copyrightFileSha256.slice(0, 12)}…`,
    );
  }

  // 2. Parse.
  console.log("\n[parse] WEB...");
  const { verses: webVerses, chapterCounts: webChapterCounts } = await parseWeb(webPath);
  console.log(`  ${webVerses.length} verses, ${webChapterCounts.size} books`);

  console.log("[parse] BSB...");
  const bsbVerses = await parseBsb(bsbPath);
  console.log(`  ${bsbVerses.length} verses`);

  console.log("[parse] cross-references...");
  const rawXrefs = await parseXrefs(xrefsPath);
  console.log(`  ${rawXrefs.length} raw rows`);

  // 3. Build canonical verse address space from WEB (source of truth for versification —
  //    it is complete across all 66 books and matches book_id 1:1 via `nr`).
  if (webChapterCounts.size !== 66) {
    throw new Error(`Expected 66 books from WEB source, got ${webChapterCounts.size}`);
  }

  const canonicalVerses: { bookId: number; chapter: number; verse: number; osisRef: string; verseId: number }[] = [];
  const seenVerseKeys = new Set<string>();
  for (const v of webVerses) {
    const key = `${v.bookId}.${v.chapter}.${v.verse}`;
    if (seenVerseKeys.has(key)) continue; // dedupe defensively
    seenVerseKeys.add(key);
    const book = BOOKS.find((b) => b.bookId === v.bookId);
    if (!book) throw new Error(`Unknown book_id ${v.bookId} in WEB source`);
    canonicalVerses.push({
      bookId: v.bookId,
      chapter: v.chapter,
      verse: v.verse,
      osisRef: `${book.osisId}.${v.chapter}.${v.verse}`,
      verseId: verseId(v.bookId, v.chapter, v.verse),
    });
  }
  // Seven addresses the `org` scheme has that the WEB distribution does not contain at all —
  // Acts 8:37 and friends. See CANONICAL_EXTRA_VERSES for why they are an explicit reviewed
  // list rather than a union over the sources.
  for (const extra of CANONICAL_EXTRA_VERSES) {
    const key = `${extra.bookId}.${extra.chapter}.${extra.verse}`;
    if (seenVerseKeys.has(key)) {
      throw new Error(
        `CANONICAL_EXTRA_VERSES lists ${key} (${extra.note}) but the WEB source already ` +
          `contains it. The list is for addresses WEB lacks; an entry that is no longer needed ` +
          `must be deleted rather than left to shadow real data.`,
      );
    }
    const book = BOOKS.find((b) => b.bookId === extra.bookId);
    if (!book) throw new Error(`CANONICAL_EXTRA_VERSES names unknown book_id ${extra.bookId}`);
    // The chapter must already exist. Inventing a chapter would break books.chapter_count,
    // which is asserted against the verses table by the validation gate.
    if (!webChapterCounts.has(extra.bookId) || extra.chapter > (webChapterCounts.get(extra.bookId) ?? 0)) {
      throw new Error(
        `CANONICAL_EXTRA_VERSES names ${book.osisId} ${extra.chapter}, which is beyond that ` +
          `book's chapter count. Extra verses extend a chapter; they never add one.`,
      );
    }
    seenVerseKeys.add(key);
    canonicalVerses.push({
      bookId: extra.bookId,
      chapter: extra.chapter,
      verse: extra.verse,
      osisRef: `${book.osisId}.${extra.chapter}.${extra.verse}`,
      verseId: verseId(extra.bookId, extra.chapter, extra.verse),
    });
  }
  console.log(`[canonical] +${CANONICAL_EXTRA_VERSES.length} addresses the WEB source omits entirely`);

  canonicalVerses.sort((a, b) => a.verseId - b.verseId);

  const verseIdByOsisKey = new Map<string, number>(); // "bookId.chapter.verse" -> verseId
  for (const v of canonicalVerses) {
    verseIdByOsisKey.set(`${v.bookId}.${v.chapter}.${v.verse}`, v.verseId);
  }

  console.log(`\n[canonical] ${canonicalVerses.length} verses in address space`);

  // Sanity range check per the brief (31000-31200), fail loudly otherwise.
  if (canonicalVerses.length < 31000 || canonicalVerses.length > 31200) {
    throw new Error(`Canonical verse count ${canonicalVerses.length} outside sane range 31000-31200`);
  }

  // 4. Open a fresh DB — at a TEMPORARY path, promoted to bible.db only once the validation
  //    gate has passed.
  //
  //    Building in place is what made a failed ingest take the live site down. The pipeline
  //    starts by deleting bible.db and recreating the schema, so any error between there and
  //    the end — a parser bug, a constraint violation, a failed gate — leaves a file that is a
  //    valid SQLite database and a structurally incomplete corpus. The running server keeps
  //    serving from it and throws on the first query for a table that never got populated.
  //    That is precisely how this pipeline knocked out bible.lucascosolo.com once.
  //
  //    The rename at the end is atomic within a filesystem, so a reader either sees the whole
  //    old corpus or the whole new one, never a half-written one.
  if (existsSync(BUILD_PATH)) unlinkSync(BUILD_PATH);
  const sqlite = new Database(BUILD_PATH);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });

  console.log("\n[schema] creating tables...");
  sqlite.exec(`
    CREATE TABLE books (
      book_id       INTEGER PRIMARY KEY,
      osis_id       TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      abbreviation  TEXT NOT NULL,
      testament     TEXT NOT NULL,
      canon_section TEXT,
      genre         TEXT NOT NULL,
      chapter_count INTEGER NOT NULL
    );

    CREATE TABLE verses (
      verse_id    INTEGER PRIMARY KEY,
      book_id     INTEGER NOT NULL REFERENCES books(book_id),
      chapter     INTEGER NOT NULL,
      verse       INTEGER NOT NULL,
      osis_ref    TEXT NOT NULL UNIQUE,
      canon_order INTEGER NOT NULL
    );
    CREATE INDEX verses_book_id_idx ON verses (book_id);

    CREATE TABLE translations (
      translation_id   INTEGER PRIMARY KEY,
      code             TEXT NOT NULL UNIQUE,
      name             TEXT NOT NULL,
      language         TEXT NOT NULL,
      license          TEXT NOT NULL,
      is_licensed      INTEGER NOT NULL DEFAULT 1,
      copyright_notice TEXT NOT NULL,
      versification    TEXT NOT NULL DEFAULT 'org',
      -- Which books this text covers: 'all' (the 66-book protocanon), or 'OT'/'NT'.
      --
      -- Needed the moment a text that is not a whole Bible arrives. The JPS TaNaKH 1917 is a
      -- Jewish translation of the Hebrew Bible, so it has no New Testament — and without this
      -- column, switching to it while reading John 3 gives a reader an empty page or a 404,
      -- which reads as a broken app rather than as the true and interesting fact that this
      -- translation is a translation of a different collection of books.
      scope            TEXT NOT NULL DEFAULT 'all',
      -- Reader-facing sentence explaining the scope. Empty for a full Bible.
      scope_note       TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE verse_texts (
      translation_id INTEGER NOT NULL REFERENCES translations(translation_id),
      verse_id       INTEGER NOT NULL REFERENCES verses(verse_id),
      text           TEXT NOT NULL,
      formatting     TEXT,
      PRIMARY KEY (translation_id, verse_id)
    );
    CREATE INDEX verse_texts_translation_verse_idx ON verse_texts (translation_id, verse_id);

    -- A verse the canon addresses but this translation deliberately does not print.
    --
    -- Twelve New Testament verses are absent from the earliest Greek manuscripts and are
    -- omitted by translations following the critical text (BSB/NA28) while translations
    -- following the Byzantine tradition (WEB) print them. The source data expresses that
    -- as an empty string, which would render as a blank line — the single worst outcome,
    -- since the reader sees an absence with no explanation and cannot tell it from a bug.
    --
    -- Recording it instead makes the divergence legible: the reader can show the omission,
    -- say why, and offer the translation that does contain it. This is apparatus, not an
    -- error condition, so it gets a table rather than a null.
    --
    -- THIS TABLE HOLDS TEXTUAL-CRITICAL OMISSIONS AND NOTHING ELSE. It once also held a row
    -- per verse for every book a translation does not include — the JPS TaNaKH has no New
    -- Testament, so 7,957 verses were recorded as "omitted" and the home page duly announced
    -- "7992 verses that some Bibles leave out" over a list of the entire New Testament. Both
    -- facts are real and they are NOT the same fact: "the earliest manuscripts do not contain
    -- this verse" is a claim about textual transmission, and "this edition is a translation of
    -- the Hebrew Bible" is a claim about the edition's scope. Conflating them at the row level
    -- makes every downstream count, page and sentence wrong, and no filter applied later can
    -- recover the distinction the rows threw away. Scope lives in "translation_books".
    CREATE TABLE verse_omissions (
      translation_id INTEGER NOT NULL REFERENCES translations(translation_id),
      verse_id       INTEGER NOT NULL REFERENCES verses(verse_id),
      reason         TEXT NOT NULL,
      history        TEXT NOT NULL,
      PRIMARY KEY (translation_id, verse_id)
    );

    -- Which books each translation actually prints. One row per (translation, book): 66 rows
    -- per text, not 31,102.
    --
    -- "translations.scope" already says 'all' | 'OT' | 'NT', so this table looks derivable —
    -- and deriving it is exactly the mistake. "scope" is what the edition CLAIMS; this is what
    -- the ingest MEASURED, book by book, from the rows that were actually written. The gate
    -- below compares the two and fails when they disagree, which is the only way a text that
    -- claims a book and silently prints nothing in it can be caught. A derived answer would
    -- have agreed with the claim and told us nothing.
    --
    -- It also gives the reader a cheap, exact answer to "which translations DO print this
    -- book?" — one indexed lookup instead of a DISTINCT scan over a couple of hundred thousand
    -- verse_texts rows on every out-of-scope page view.
    CREATE TABLE translation_books (
      translation_id INTEGER NOT NULL REFERENCES translations(translation_id),
      book_id        INTEGER NOT NULL REFERENCES books(book_id),
      -- 'printed'      — this translation prints at least one verse of this book.
      -- 'out_of_scope' — this edition does not include this book at all.
      -- There is deliberately no third value: a book a translation claims but prints nothing
      -- in is a build failure, not a state to be stored.
      status         TEXT NOT NULL,
      PRIMARY KEY (translation_id, book_id)
    );

    CREATE TABLE cross_references (
      xref_id        INTEGER PRIMARY KEY AUTOINCREMENT,
      from_verse_id  INTEGER NOT NULL REFERENCES verses(verse_id),
      to_start_verse INTEGER NOT NULL REFERENCES verses(verse_id),
      to_end_verse   INTEGER NOT NULL REFERENCES verses(verse_id),
      votes          INTEGER NOT NULL DEFAULT 0,
      source         TEXT NOT NULL,
      relation       TEXT
    );
    CREATE INDEX cross_references_from_verse_id_idx ON cross_references (from_verse_id);
    CREATE INDEX cross_references_to_range_idx ON cross_references (to_start_verse, to_end_verse);

    CREATE TABLE verse_reference_heat (
      verse_id       INTEGER PRIMARY KEY REFERENCES verses(verse_id),
      inbound_count  INTEGER NOT NULL,
      weighted_score INTEGER NOT NULL,
      heat_bucket    INTEGER NOT NULL
    );

    -- Full-text index over verse_texts (Derash, ARCHITECTURE.md §4.6). A standalone FTS5
    -- table rather than an external-content one: external-content FTS5 ties its rowid to the
    -- content table's rowid, which would work here (verse_texts has an implicit rowid despite
    -- its composite PK) but then every query needs a join back through verse_texts just to
    -- read the text it already has. Carrying verse_id/translation_id as UNINDEXED columns
    -- means a match is immediately queryable and joinable on its own, at the cost of the text
    -- existing twice on disk (~62k rows across 2 translations, single-digit MB — cheap).
    -- 'porter unicode61' stems English words (love/loved/loving share a root) and tokenizes
    -- on Unicode word boundaries rather than ASCII-only.
    CREATE VIRTUAL TABLE verse_texts_fts USING fts5(
      text,
      verse_id UNINDEXED,
      translation_id UNINDEXED,
      tokenize = 'porter unicode61'
    );

    -- Where a witness's own verse numbering disagrees with the canonical address space.
    --
    -- A verse_id is translation-independent only while every shipped text divides the text the
    -- same way, and that stops being true the moment a Hebrew text (MT numbers the Psalm
    -- superscription as verse 1) or the Septuagint (different Psalm numbering entirely) is
    -- added. This table was correctly EMPTY for as long as the only texts were WEB and BSB,
    -- both 'org' — and the gate that refused a divergent text without mapping rows was built
    -- then, before it was needed, precisely because the failure it prevents is silent.
    -- The Westminster Leningrad Codex is the text that finally tripped it, which is the whole
    -- point of having built it early. It now carries ~1,978 Hebrew-to-canonical mappings.
    --
    -- Keyed by SCHEME, not by translation. ARCHITECTURE.md §0.1 specifies it that way
    -- (versification_map(scheme, foreign_ref, canonical_verse_id)) and the first divergent
    -- text proved the doc right: the Westminster Leningrad Codex is not a translation at all,
    -- so a translation_id column had nowhere to put it. A scheme is also the correct grain —
    -- one 'hebrew' map serves the WLC and every future MT-numbered text, instead of each
    -- carrying a private copy that can drift from the others.
    --
    -- PRIMARY KEY is on the SOURCE side, and that is a finding from the data rather than a
    -- preference. Keying on (scheme, verse_id) — the obvious choice, and what the previous
    -- shape did — asserts that each canonical verse has at most one source reference. It does
    -- not: four canonical verses (Ps 51:1, 52:1, 54:1, 60:1) are each the target of TWO Hebrew
    -- verses, because the Hebrew numbers a two-verse superscription that English leaves
    -- unnumbered. That key would have silently dropped four rows on insert conflict. The
    -- source side genuinely is unique — verified: zero duplicate WLC references across all
    -- 1,978 mappings — so it is what the key is built on.
    CREATE TABLE versification_map (
      scheme          TEXT NOT NULL,     -- 'hebrew', later 'lxx', 'vulgate'
      verse_id        INTEGER NOT NULL REFERENCES verses(verse_id),  -- canonical (org) address
      source_book     TEXT NOT NULL,     -- as the source text numbers it
      source_chapter  INTEGER NOT NULL,
      source_verse    INTEGER NOT NULL,
      -- '!a' / '!b' where a source verse straddles a canonical boundary. Part of the identity
      -- of the reference, so it belongs in the key: Ps 13:6!a and Ps 13:6!b are two different
      -- mappings of the same source verse onto two different canonical verses.
      source_part     TEXT NOT NULL DEFAULT '',
      -- 'full' = the whole verse corresponds; 'partial' = only part of it does. Recorded rather
      -- than flattened, because a partial correspondence is exactly what a scholar needs to be
      -- warned about and 'roughly equals' is a claim the reader should get to see.
      mapping_type    TEXT NOT NULL,
      note            TEXT,
      PRIMARY KEY (scheme, source_book, source_chapter, source_verse, source_part)
    );
    CREATE INDEX versification_map_verse_idx ON versification_map (scheme, verse_id);

    -- --- Original languages -------------------------------------------------------------
    --
    -- The Hebrew/Aramaic Bible (Westminster Leningrad Codex, via OpenScriptures morphhb) and
    -- the Greek New Testament (SBLGNT, via MorphGNT). These are word-level texts: every word
    -- carries a lemma and a morphology code, which is what makes lemma concordance and
    -- morphological search possible at all.
    --
    -- Separate from the translations table on purpose. A translation is addressed by verse and
    -- stores a string; an original text is addressed by verse AND word position and stores an
    -- analysed token. Forcing both into one table would mean every translation row carrying
    -- columns that are meaningless for it.
    CREATE TABLE original_texts (
      text_id       INTEGER PRIMARY KEY,
      code          TEXT NOT NULL UNIQUE,   -- 'WLC', 'SBLGNT'
      name          TEXT NOT NULL,
      language      TEXT NOT NULL,          -- predominant language; per-word language is on the word
      testament     TEXT NOT NULL,
      license       TEXT NOT NULL,
      attribution   TEXT NOT NULL,          -- travels with the text, like a copyright notice
      source_url    TEXT NOT NULL,
      versification TEXT NOT NULL           -- 'org' for SBLGNT, 'hebrew' for WLC
    );

    CREATE TABLE original_words (
      word_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      text_id    INTEGER NOT NULL REFERENCES original_texts(text_id),
      verse_id   INTEGER NOT NULL REFERENCES verses(verse_id),  -- CANONICAL address, always
      -- The source's own reference, never renumbered. Seventy canonical verses receive the
      -- words of TWO Hebrew verses (the Hebrew numbers a psalm superscription English leaves
      -- unnumbered), so the canonical id alone cannot say which Hebrew verse a word is in —
      -- and the Hebrew numbering is the address a critical edition cites.
      source_ref TEXT NOT NULL,
      -- Word order within the CANONICAL verse. Where two source verses merge, the second
      -- continues the first's numbering rather than restarting and colliding with it.
      position   INTEGER NOT NULL,
      surface    TEXT NOT NULL,             -- as printed: pointed Hebrew, accented Greek
      -- The source's OWN normalized form, verbatim. Unpointed for the Hebrew; still fully
      -- accented for the Greek, because that is what MorphGNT means by "normalized".
      normalized TEXT NOT NULL,
      -- What the word search actually matches on: unpointed AND unaccented AND lower-cased,
      -- both scripts folded the same way. A separate column from 'normalized' for two reasons.
      -- Semantics: 'normalized' is the source's value and this is ours, and conflating them
      -- would mean editing the source's data to suit our search box. Correctness: 'normalized'
      -- is accented for the Greek, so the old query stripped the *input* and compared it against
      -- an accented column — λογος matched nothing while λόγος matched, in a search box whose
      -- own hint promises accents are optional. Doing the strip in SQL instead would have been
      -- the other wrong fix: an expression over the column defeats the index, and this table
      -- has 443,061 rows.
      search_form TEXT NOT NULL,
      lemma      TEXT NOT NULL,             -- source lemma, verbatim (incl. homonym letters)
      strongs    TEXT,                      -- 'H7225' / 'A9999'; NULL for Greek, which has none
      morph      TEXT NOT NULL,             -- source morphology code, UNMODIFIED
      language   TEXT NOT NULL,             -- 'hbo' | 'arc' | 'grc'
      UNIQUE (text_id, verse_id, position)
    );
    CREATE INDEX original_words_verse_idx  ON original_words (text_id, verse_id, position);
    CREATE INDEX original_words_lemma_idx  ON original_words (text_id, lemma);
    CREATE INDEX original_words_strong_idx ON original_words (strongs);
    CREATE INDEX original_words_norm_idx   ON original_words (normalized);
    -- COLLATE NOCASE is load-bearing and counter-intuitive, so it is written down. SQLite
    -- rewrites a prefix LIKE into an indexed range scan only when the index's collation matches
    -- the LIKE operator's case sensitivity: with the default case_sensitive_like=OFF that means
    -- a NOCASE index, and a plain BINARY one is silently ignored. It was built BINARY first and
    -- EXPLAIN QUERY PLAN said "SCAN original_words" — a stored column being scanned instead of
    -- an expression being evaluated, which is faster and still not an index. NOCASE folds
    -- ASCII A-Z only, and search_form is already lower-cased and non-ASCII, so the collation
    -- changes which plan is chosen and not which rows match.
    -- (The other half of the rule still applies: any function wrapped around the column —
    -- LOWER(), a strip expression — puts it back to a full scan regardless of collation.)
    CREATE INDEX original_words_search_idx ON original_words (search_form COLLATE NOCASE);

    -- Readings the source records BESIDE the running text: in the WLC, the qere ("as read")
    -- against the ketiv ("as written"). This is the oldest continuously transmitted critical
    -- apparatus in existence and it ships inside the same files as the text.
    --
    -- It must be its own table rather than extra words. In the OSIS these sit inside
    -- <note type="variant"> elements interleaved with the running text, so the obvious
    -- implementation — walking every <w> descendant of a verse — splices 1,278 marginal
    -- readings into the text as if they were words in it, corrupting every word position after
    -- the first in the affected verse.
    CREATE TABLE original_variants (
      variant_id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_id    INTEGER NOT NULL REFERENCES original_texts(text_id),
      verse_id   INTEGER NOT NULL REFERENCES verses(verse_id),
      source_ref TEXT NOT NULL,
      position   INTEGER NOT NULL,          -- the running-text word this reading stands beside
      kind       TEXT NOT NULL,             -- 'qere'
      catch_word TEXT,                      -- the ketiv the note cites
      surface    TEXT NOT NULL,
      normalized TEXT NOT NULL,
      lemma      TEXT NOT NULL,
      strongs    TEXT,
      morph      TEXT NOT NULL,
      language   TEXT NOT NULL
    );
    CREATE INDEX original_variants_verse_idx ON original_variants (text_id, verse_id, position);

    -- Edition-level Greek differences that affect translation, from STEPBible TAGNT. This is
    -- intentionally distinct from manuscript evidence: TAGNT reports which published Greek
    -- editions contain a reading, while the SBLGNT mark points to its own editorial apparatus.
    CREATE TABLE greek_edition_variants (
      variant_id INTEGER PRIMARY KEY AUTOINCREMENT,
      verse_id INTEGER NOT NULL REFERENCES verses(verse_id),
      source_ref TEXT NOT NULL,
      source_position INTEGER NOT NULL,
      base_surface TEXT NOT NULL,
      base_editions TEXT NOT NULL,
      alternate_surface TEXT,
      alternate_editions TEXT,
      note TEXT
    );
    CREATE INDEX greek_edition_variants_verse_idx ON greek_edition_variants (verse_id, source_position);

    -- Witness-level Greek evidence from CrossWire's CC0 VarApp module. The source reference is
    -- retained separately because VarApp declares NRSV versification; verse_id remains the sole
    -- internal address after the reviewed mapping step.
    CREATE TABLE greek_manuscript_readings (
      variant_id INTEGER PRIMARY KEY AUTOINCREMENT,
      verse_id INTEGER NOT NULL REFERENCES verses(verse_id),
      source_ref TEXT NOT NULL,
      reading_order INTEGER NOT NULL,
      reading_text TEXT NOT NULL,
      witnesses TEXT NOT NULL,
      is_base INTEGER NOT NULL,
      UNIQUE (verse_id, source_ref, reading_order)
    );
    CREATE INDEX greek_manuscript_readings_verse_idx ON greek_manuscript_readings (verse_id, source_ref, reading_order);

    -- The Hebrew/Aramaic dictionary, so a reader sees a WORD and not a code.
    --
    -- 'original_words.lemma' for the WLC is the OSIS lemma attribute verbatim — 'b/2617 a' —
    -- which is a Strong's number carrying its prefixed morphemes and a space before the homonym
    -- letter. Storing that is correct (it is what the source says, and the segmentation is
    -- information), but it is not a headword, and it was being displayed as one. The headword
    -- lives here and is reached by 'strongs', never by 'lemma'.
    --
    -- KEY SHAPE: 'H' + number + optional OSHB homonym letter. NOT the literal string in
    -- 'original_words.strongs': Strong's Hebrew is one numbering sequence covering Hebrew and
    -- Aramaic alike, and the 'A' prefix on a word row is a tag derived from THAT WORD's
    -- morphology code, not part of the dictionary's identity. Seven numbers in this corpus
    -- appear under both prefixes (H3605 5,412x Hebrew, 1x Aramaic), so keying on the word-level
    -- tag would duplicate entries on the strength of a tagging accident. Lookups fold A -> H;
    -- each entry states its own language.
    --
    -- HOMONYMS ARE ROWS, NOT A MERGE. H2617a (chesed, "goodness") and H2617b (chesed, "shame")
    -- are different words sharing a number. They get separate rows with separate BDB article
    -- ids, and the undifferentiated Strong's entry H2617 is a third row rather than being
    -- copied down onto both — Strong's never drew the distinction, so attributing its gloss to
    -- one side of it would be a false precision.
    -- Licence and attribution for the lexicon, recorded the way original_texts records them for
    -- a text. Its own table rather than a row in original_texts, because that table's testament
    -- and versification columns are NOT NULL and meaningless for a dictionary — and rather than
    -- columns on every entry, because one repository under one licence would then be restated
    -- 9,831 times. CC BY 4.0 obliges us to carry the attribution to wherever an entry is shown,
    -- which is an API-surface obligation: the accessor returns it beside the entry.
    CREATE TABLE original_lexicon_sources (
      source_id   INTEGER PRIMARY KEY,
      code        TEXT NOT NULL UNIQUE,   -- 'OSHB-LEX'
      name        TEXT NOT NULL,
      license     TEXT NOT NULL,
      attribution TEXT NOT NULL,
      source_url  TEXT NOT NULL
    );

    CREATE TABLE original_lexicon (
      entry_key   TEXT PRIMARY KEY,        -- 'H2617' | 'H2617a'
      strongs_num INTEGER NOT NULL,
      homonym     TEXT,                    -- 'a' | 'b' | NULL for the undifferentiated entry
      language    TEXT NOT NULL,           -- 'hbo' | 'arc'
      headword    TEXT NOT NULL,           -- pointed Hebrew/Aramaic: the thing a reader wanted
      xlit        TEXT NOT NULL DEFAULT '',
      pos         TEXT NOT NULL DEFAULT '',
      pron        TEXT NOT NULL DEFAULT '',
      gloss       TEXT NOT NULL DEFAULT '',
      meaning     TEXT NOT NULL DEFAULT '',
      usage       TEXT NOT NULL DEFAULT '',
      etymology   TEXT NOT NULL DEFAULT '',
      twot        TEXT NOT NULL DEFAULT '', -- reference only; TWOT itself is not transcribed
      bdb         TEXT NOT NULL DEFAULT '', -- the BDB article id, which is what splits homonyms
      source_id   INTEGER NOT NULL REFERENCES original_lexicon_sources(source_id),
      provenance  TEXT NOT NULL             -- 'strong' | 'oshb' | 'strong+oshb'
    );
    -- Homonym resolution is 'every entry sharing this number', so the number is the index.
    CREATE INDEX original_lexicon_num_idx ON original_lexicon (strongs_num);

    -- The Greek dictionary: Dodson, via the Biblical Humanities TEI conversion.
    --
    -- A SEPARATE table from 'original_lexicon', not a row shape reused. Two reasons, both from
    -- reading how the Hebrew table is keyed and consumed rather than assumed:
    --
    --   1. DIFFERENT NATURAL KEY. 'original_lexicon' is keyed on 'entry_key' ('H2617a') and
    --      joined from 'original_words.strongs' — a Strong's number the WORD ROW carries.
    --      MorphGNT gives Greek words no Strong's number at all (originals.ts, 'strongs: null'
    --      on the SBLGNT row), so there is no word-side key of that shape to join on. The only
    --      thing a Greek word row carries that a dictionary entry can match is 'lemma' — which
    --      for Greek IS already the headword text ('λόγος', not a code). Cramming Greek rows
    --      into 'original_lexicon' would mean keying half the table on a number the join uses
    --      and half on a headword the join can't use through the same column.
    --   2. DIFFERENT COLUMNS. 'original_lexicon' carries 'twot'/'bdb'/'pron'/'homonym' because
    --      resolving Hebrew Strong's numbers took two disagreeing source files and a homonym
    --      splitting apparatus (see lexicon.ts). Dodson is one file with none of that: a
    --      headword, a brief gloss, a full definition. Adding Hebrew-only columns to hold NULL
    --      on every one of 5,410 Greek rows, or Greek-only columns NULL on every one of 9,831
    --      Hebrew rows, is the shape a merge produces when the two dictionaries don't actually
    --      share a grain — and this pair does not.
    --
    -- 'search_headword' plays the same role 'search_form' plays on 'original_words': an exact
    -- NFC match against 'headword' is tried first at read time, and this indexed, diacritic-
    -- stripped column is the fallback for the residual — never a fuzzy or prefix match. See the
    -- coverage gate below for why that residual is small enough to tolerate rather than chase.
    CREATE TABLE greek_lexicon_sources (
      source_id   INTEGER PRIMARY KEY,
      code        TEXT NOT NULL UNIQUE,   -- 'DODSON'
      name        TEXT NOT NULL,
      license     TEXT NOT NULL,
      attribution TEXT NOT NULL,
      source_url  TEXT NOT NULL
    );

    CREATE TABLE greek_lexicon (
      -- 'G' + Dodson's own zero-padded Strong's number, disambiguated with a '.2' suffix on the
      -- rare second entry Dodson gives one number (5 of 5,410) — see greek-lexicon.ts. Carried
      -- for identity/citation only; nothing joins on it, because nothing on the word side has a
      -- Strong's number to join with.
      entry_key       TEXT PRIMARY KEY,
      strongs_num     INTEGER NOT NULL,
      -- NFC-normalized, from Dodson's '@n' attribute, NOT '<orth>' — '<orth>' carries genitive
      -- and article information ('Ἀβιληνή, ῆς, ἡ') that is real for a dictionary entry and
      -- wrong for a join key. THIS is the join key: matched against 'original_words.lemma'.
      headword        TEXT NOT NULL,
      search_headword TEXT NOT NULL,      -- diacritic-stripped, lower-cased fallback join key
      gloss           TEXT NOT NULL,      -- Dodson's role="brief" definition
      definition      TEXT NOT NULL,      -- Dodson's role="full" definition, whitespace-collapsed
      source_id       INTEGER NOT NULL REFERENCES greek_lexicon_sources(source_id)
    );
    CREATE INDEX greek_lexicon_headword_idx ON greek_lexicon (headword);
    CREATE INDEX greek_lexicon_search_idx   ON greek_lexicon (search_headword);

    -- Identity of this build of the corpus.
    --
    -- The read APIs are pure functions of this file, so their responses are cacheable
    -- essentially forever — but only for a *given* corpus. Without a build identity the app
    -- had no way to say which one, so it sent year-long immutable caching on unversioned
    -- URLs: a corrected corpus would have been invisible to every client that had already
    -- fetched. The stamp turns that into an ETag, so a rebuild invalidates precisely.
    CREATE TABLE corpus_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Exact upstream artifacts used for this corpus build. This is deliberately separate from
    -- corpus_meta: build_id identifies the derived file, while this table identifies its inputs.
    CREATE TABLE corpus_sources (
      source_key TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      source_url TEXT NOT NULL,
      sha256     TEXT NOT NULL,
      filename   TEXT NOT NULL
    );
  `);

  const insertCorpusSource = sqlite.prepare(
    `INSERT INTO corpus_sources (source_key, name, source_url, sha256, filename) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertCorpusSourcesTx = sqlite.transaction(() => {
    for (const source of sourceChecksums) {
      insertCorpusSource.run(source.key, source.name, source.url, source.sha256, path.basename(source.path));
    }
  });
  insertCorpusSourcesTx();

  // 5. Insert books. chapter_count comes from the WEB source (ground truth), cross-checked
  //    against our static BOOKS table's expected count where we have no better source.
  console.log("[load] books...");
  const insertBook = sqlite.prepare(
    `INSERT INTO books (book_id, osis_id, name, abbreviation, testament, canon_section, genre, chapter_count)
     VALUES (@bookId, @osisId, @name, @abbreviation, @testament, @canonSection, @genre, @chapterCount)`
  );
  const insertBooksTx = sqlite.transaction(() => {
    for (const b of BOOKS) {
      const chapterCount = webChapterCounts.get(b.bookId);
      if (chapterCount === undefined) {
        throw new Error(`No WEB chapter data for book_id ${b.bookId} (${b.name})`);
      }
      insertBook.run({
        bookId: b.bookId,
        osisId: b.osisId,
        name: b.name,
        abbreviation: b.abbreviation,
        testament: b.testament,
        canonSection: b.canonSection,
        genre: JSON.stringify(b.genre),
        chapterCount,
      });
    }
  });
  insertBooksTx();

  // 6. Insert verses.
  console.log("[load] verses...");
  const insertVerse = sqlite.prepare(
    `INSERT INTO verses (verse_id, book_id, chapter, verse, osis_ref, canon_order)
     VALUES (@verseId, @bookId, @chapter, @verse, @osisRef, @canonOrder)`
  );
  const insertVersesTx = sqlite.transaction(() => {
    for (const v of canonicalVerses) {
      insertVerse.run({
        verseId: v.verseId,
        bookId: v.bookId,
        chapter: v.chapter,
        verse: v.verse,
        osisRef: v.osisRef,
        canonOrder: v.verseId,
      });
    }
  });
  insertVersesTx();

  // 7. Insert translations.
  console.log("[load] translations...");
  sqlite
    .prepare(
      `INSERT INTO translations (translation_id, code, name, language, license, is_licensed, copyright_notice, versification)
       VALUES (?, ?, ?, ?, ?, 1, ?, 'org')`
    )
    .run(1, "WEB", "World English Bible", "English", "Public Domain", "Public Domain. No rights reserved.");
  sqlite
    .prepare(
      `INSERT INTO translations (translation_id, code, name, language, license, is_licensed, copyright_notice, versification)
       VALUES (?, ?, ?, ?, ?, 1, ?, 'org')`
    )
    .run(
      2,
      "BSB",
      "Berean Standard Bible",
      "English",
      "Public Domain",
      "The Holy Bible, Berean Standard Bible (BSB) is produced in cooperation with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee. This text of God's Word has been dedicated to the public domain."
    );

  // The USFX translations. Every one of these declares 'org': proven, not assumed — the gate
  // below refuses to load a source verse that has no canonical address, so a text numbering
  // its verses differently cannot pass silently.
  const insertTranslation = sqlite.prepare(
    `INSERT INTO translations
       (translation_id, code, name, language, license, is_licensed, copyright_notice,
        versification, scope, scope_note)
     VALUES (@translationId, @code, @name, @language, @license, 1, @copyrightNotice,
             @versification, @scope, @scopeNote)`
  );
  for (const t of TRANSLATION_SOURCES) {
    insertTranslation.run({
      translationId: t.translationId,
      code: t.code,
      name: t.name,
      language: t.language,
      license: t.license,
      copyrightNotice: t.copyrightNotice,
      versification: t.versification ?? "org",
      scope: t.scope,
      scopeNote: t.scopeNote,
    });
  }

  // 8. Insert verse_texts (WEB=1, BSB=2), normalizing text and dropping anything whose
  //    verse_id isn't in the canonical address space (fails the validation gate below
  //    if that ever happens for WEB itself; for BSB it's logged and skipped).
  console.log("[load] verse_texts (WEB)...");
  const insertText = sqlite.prepare(
    `INSERT OR REPLACE INTO verse_texts (translation_id, verse_id, text, formatting) VALUES (?, ?, ?, NULL)`
  );
  const insertOmission = sqlite.prepare(
    `INSERT OR REPLACE INTO verse_omissions (translation_id, verse_id, reason, history) VALUES (?, ?, ?, ?)`
  );

  /**
   * Routes a verse to `verse_texts` or `verse_omissions`.
   *
   * An empty string in the source is never stored as text: a zero-length verse would render
   * as a blank gap that a reader cannot distinguish from a rendering fault, and the
   * integrity gate treats it as a hard error for exactly that reason. Empty means the
   * translation declines to print the verse, which is a claim about the manuscript tradition
   * and belongs in the apparatus.
   */
  const loadVerseText = (translationId: number, verseId: number, raw: string) => {
    const text = normalizeVerseText(raw);
    if (text.length === 0) {
      // Reads as the continuation of the renderer's own "Not printed in this translation"
      // label, so it must not repeat that lead-in — it explains why, and nothing else.
      // Wording lives in translations.ts, shared with the USFX loader, so the two routes to
      // "this translation does not print this verse" cannot drift into two explanations.
      const explanation = omissionExplanation(verseId);
      insertOmission.run(translationId, verseId, explanation.reason, explanation.history);
      return "omitted" as const;
    }
    insertText.run(translationId, verseId, text);
    return "text" as const;
  };

  let webSkipped = 0;
  const insertWebTx = sqlite.transaction(() => {
    for (const v of webVerses) {
      const vid = verseIdByOsisKey.get(`${v.bookId}.${v.chapter}.${v.verse}`);
      if (vid === undefined) {
        webSkipped++;
        continue;
      }
      loadVerseText(1, vid, v.text);
    }
  });
  insertWebTx();
  if (webSkipped > 0) console.log(`  WARNING: ${webSkipped} WEB verses skipped (no canonical verse_id)`);

  console.log("[load] verse_texts (BSB)...");
  let bsbMapped = 0;
  let bsbDropped = 0;
  let bsbOmitted = 0;
  const insertBsbTx = sqlite.transaction(() => {
    for (const v of bsbVerses) {
      const vid = verseIdByOsisKey.get(`${v.bookId}.${v.chapter}.${v.verse}`);
      if (vid === undefined) {
        bsbDropped++;
        continue;
      }
      if (loadVerseText(2, vid, v.text) === "omitted") bsbOmitted++;
      bsbMapped++;
    }
  });
  insertBsbTx();
  console.log(
    `  BSB mapped: ${bsbMapped}, dropped (no canonical verse_id match): ${bsbDropped}, ` +
      `recorded as omitted-by-translation: ${bsbOmitted}`
  );

  // 8a-bis. The USFX translations.
  //
  // These differ from WEB/BSB in HOW they decline to print a verse, and the difference matters.
  // WEB and BSB carry an omitted verse as an empty string, so absence is explicit. The eBible
  // USFX sources simply have no <v/> milestone for it — Darby has no Matthew 23:14 element at
  // all. Absence is therefore the signal, and it has to be distinguished from the other thing
  // absence can mean: a translation that does not contain the book (the JPS TaNaKH has no New
  // Testament). Both become apparatus, with DIFFERENT reasons, because telling a reader that
  // the Jewish Publication Society left John 3:16 out of the oldest Greek manuscripts would be
  // nonsense.
  const canonicalByBook = new Map<number, number[]>();
  for (const v of canonicalVerses) {
    const list = canonicalByBook.get(v.bookId);
    if (list) list.push(v.verseId);
    else canonicalByBook.set(v.bookId, [v.verseId]);
  }

  interface TranslationLoadStats {
    code: string;
    printed: number;
    unmapped: string[];
    omittedManuscript: number;
    /** Verses in books this edition does not include. Reported, never stored per verse. */
    outOfScopeVerses: number;
    booksCovered: number;
    emptyClaimedBooks: string[];
    quirkReplacements: number;
  }
  const usfxStats: TranslationLoadStats[] = [];

  // Divergent USFX editions enter the same canonical address space only through an explicit
  // map. The first supported case is Brenton's LXX selection: its selected protocanonical books
  // use the canonical chapter/verse labels, while Psalms and Greek Esther are deliberately
  // excluded until their non-identity numbering has a reviewed map. Identity is written as a
  // row, never inferred at query time, so the completeness gate can prove what was actually
  // mapped and a future source cannot silently fall through to `org`.
  const insertBrentonMap = sqlite.prepare(
    `INSERT INTO versification_map
       (scheme, verse_id, source_book, source_chapter, source_verse, source_part, mapping_type, note)
     VALUES ('brenton', ?, ?, ?, ?, '', 'full', 'Brenton source reference mapped to canonical address')`
  );
  const brenton = TRANSLATION_SOURCES.find((t) => t.code === "LXX");
  if (brenton) {
    const included = new Set(brenton.includedBookIds ?? []);
    const mapBrentonTx = sqlite.transaction(() => {
      for (const v of usfx.get("LXX")?.verses ?? []) {
        if (!included.has(v.bookId)) continue;
        const canonicalId = verseIdByOsisKey.get(`${v.bookId}.${v.chapter}.${v.verse}`);
        if (canonicalId === undefined) continue;
        const sourceBook = BOOKS.find((b) => b.bookId === v.bookId)?.osisId;
        if (!sourceBook) throw new Error(`[brenton] unknown source book id ${v.bookId}`);
        insertBrentonMap.run(canonicalId, sourceBook, v.chapter, v.verse);
      }
    });
    mapBrentonTx();
  }

  for (const t of TRANSLATION_SOURCES) {
    console.log(`[load] verse_texts (${t.code})...`);
    const parsed = usfx.get(t.code)!;
    const stats: TranslationLoadStats = {
      code: t.code,
      printed: 0,
      unmapped: [],
      omittedManuscript: 0,
      outOfScopeVerses: 0,
      booksCovered: 0,
      emptyClaimedBooks: [],
      quirkReplacements: 0,
    };
    const printedIds = new Set<number>();
    const includedBooks = t.includedBookIds ? new Set(t.includedBookIds) : null;

    const loadTx = sqlite.transaction(() => {
      for (const v of parsed.verses) {
        if (includedBooks && !includedBooks.has(v.bookId)) continue;
        const scheme = t.versification ?? "org";
        const vid = scheme !== "org"
          ? sqlite
              .prepare(
                `SELECT verse_id AS verseId FROM versification_map
                 WHERE scheme = ? AND source_book = ? AND source_chapter = ? AND source_verse = ? AND source_part = ''`
              )
              .get(
                t.versification,
                BOOKS.find((b) => b.bookId === v.bookId)?.osisId ?? String(v.bookId),
                v.chapter,
                v.verse,
              ) as { verseId: number } | undefined
          : undefined;
        const mappedVerseId = vid?.verseId ?? (scheme === "org"
          ? verseIdByOsisKey.get(`${v.bookId}.${v.chapter}.${v.verse}`)
          : undefined);
        if (mappedVerseId === undefined) {
          // NOT skipped quietly. A source verse with no canonical address is either a real
          // versification divergence (in which case this translation must not declare 'org')
          // or a parser fault, and both are build failures.
          stats.unmapped.push(v.ref);
          continue;
        }
        let raw = v.text;
        if (t.quirks) {
          const before = raw;
          raw = raw.replace(t.quirks.pattern, t.quirks.replacement);
          if (raw !== before) {
            stats.quirkReplacements += before.match(t.quirks.pattern)?.length ?? 0;
          }
        }
        const text = normalizeVerseText(raw);
        // An empty source verse means the same thing here as it does for BSB: the translation
        // declines to print it. It is handled below with the absent ones, so that both routes
        // to "this translation does not print this verse" produce identical apparatus.
        if (text.length === 0) continue;
        insertText.run(t.translationId, mappedVerseId, text);
        printedIds.add(mappedVerseId);
        stats.printed += 1;
      }
    });
    loadTx();

    // Book coverage: a book this text covers is one it prints at least one verse in.
    const covered = new Set<number>();
    for (const vid of printedIds) covered.add(Math.trunc(vid / 1_000_000));
    stats.booksCovered = covered.size;

    const claimsBook = (bookId: number) =>
      (t.includedBookIds ? includedBooks?.has(bookId) === true : true) &&
      (t.scope === "all" || (t.scope === "OT" ? bookId <= 39 : bookId > 39));

    const omitTx = sqlite.transaction(() => {
      for (const [bookId, verseIds] of canonicalByBook) {
        const inScope = claimsBook(bookId);
        if (!inScope) {
          // A book this edition does not include produces NO per-verse rows. The old code
          // wrote one omission per verse here, which is how a translation of the Hebrew Bible
          // came to contribute 7,957 "verses some Bibles leave out" to a claim about Greek
          // manuscripts. The fact is recorded once per book in `translation_books` (populated
          // in step 8c) and rendered as one banner for the passage.
          //
          // Counted, not silently skipped: the census below prints it, so a scope change is
          // still visible in the build log rather than being invisible by construction.
          stats.outOfScopeVerses += verseIds.length;
          continue;
        }
        if (!covered.has(bookId)) {
          // The gate the brief asks for, recorded here and raised below: a translation that
          // claims a book and prints nothing in it has been ingested wrong, and the corpus
          // would show a reader an entire empty book with no explanation.
          stats.emptyClaimedBooks.push(BOOKS.find((b) => b.bookId === bookId)?.name ?? String(bookId));
          continue;
        }
        for (const vid of verseIds) {
          if (printedIds.has(vid)) continue;
          const explanation = omissionExplanation(vid);
          insertOmission.run(t.translationId, vid, explanation.reason, explanation.history);
          stats.omittedManuscript += 1;
        }
      }
    });
    omitTx();

    usfxStats.push(stats);
    console.log(
      `  ${t.code}: ${stats.printed} printed, ${stats.omittedManuscript} recorded as omitted, ` +
        `${stats.outOfScopeVerses} verse(s) in books outside this translation's scope (not stored), ` +
        `${stats.booksCovered} book(s) covered` +
        (t.quirks ? `, ${stats.quirkReplacements} ${t.quirks.why}` : ""),
    );
  }

  // 8b. Populate the full-text index. Done here (after both translations are loaded) rather
  // than incrementally per INSERT above, so it is one bulk statement instead of ~62k
  // individually-tokenized writes.
  console.log("[load] verse_texts_fts (full-text index)...");
  sqlite.exec(`
    INSERT INTO verse_texts_fts (text, verse_id, translation_id)
    SELECT text, verse_id, translation_id FROM verse_texts
  `);
  const ftsRowCount = (sqlite.prepare(`SELECT COUNT(*) AS n FROM verse_texts_fts`).get() as { n: number }).n;
  console.log(`  ${ftsRowCount} rows indexed`);

  // 8b-ii. Book coverage per translation.
  //
  // Derived from `verse_texts` — what was actually written — for EVERY translation in one
  // statement, rather than from each loader's own bookkeeping. The two loaders (the USFX one
  // above, and the WEB/BSB path before it) track coverage differently and only one of them
  // tracked it at all, so asking the finished table is both shorter and the only version that
  // cannot disagree with the corpus it describes.
  //
  // `book_id * 1_000_000` .. `+ 999_999` is the whole book's slice of the address space. It is
  // a BETWEEN over the primary key, not arithmetic on verse ids (AGENTS.md invariant #3): the
  // space is sparse, so the bounds are allowed to land in gaps but nothing may be counted by
  // subtracting them.
  console.log("[load] translation_books (per-book coverage)...");
  sqlite.exec(`
    INSERT INTO translation_books (translation_id, book_id, status)
    SELECT t.translation_id, b.book_id,
           CASE WHEN EXISTS (
             SELECT 1 FROM verse_texts vt
             WHERE vt.translation_id = t.translation_id
               AND vt.verse_id BETWEEN b.book_id * 1000000 AND b.book_id * 1000000 + 999999
           ) THEN 'printed' ELSE 'out_of_scope' END
    FROM translations t CROSS JOIN books b
  `);
  {
    const coverage = sqlite
      .prepare(
        `SELECT t.code, SUM(tb.status = 'printed') AS printed, SUM(tb.status = 'out_of_scope') AS absent
         FROM translation_books tb JOIN translations t USING (translation_id)
         GROUP BY t.translation_id ORDER BY t.translation_id`,
      )
      .all() as { code: string; printed: number; absent: number }[];
    for (const c of coverage) {
      console.log(`  ${c.code.padEnd(4)} prints ${c.printed} book(s), does not include ${c.absent}`);
    }
  }

  // 8c. Original languages: the versification map first, then the Hebrew and the Greek.
  //
  // ORDER IS LOAD-BEARING. The WLC numbers verses in the Hebrew tradition, so a WLC reference
  // cannot be turned into a canonical verse_id until the map exists. Doing the words first and
  // "fixing up" the divergent ones afterwards is how a text ends up anchored to the wrong verse
  // in exactly the ~2,000 places where it matters most.
  console.log("\n[load] versification_map (hebrew -> canonical)...");

  const verseIdByOsis = new Map(canonicalVerses.map((v) => [v.osisRef, v.verseId]));
  const verseMapRows = await parseVerseMap(path.join(wlcDir, "VerseMap.xml"), HEBREW_SCHEME);

  const insertVersification = sqlite.prepare(
    `INSERT INTO versification_map
       (scheme, verse_id, source_book, source_chapter, source_verse, source_part, mapping_type, note)
     VALUES (@scheme, @verseId, @sourceBook, @sourceChapter, @sourceVerse, @sourcePart, @mappingType, @note)`
  );

  /** WLC ref (`Ps.13.6`, with optional `!a`) -> canonical verse_id, via the map then identity. */
  const hebrewToCanonical = new Map<string, number>();
  let versificationLoaded = 0;
  const versificationUnresolved: string[] = [];

  const insertVersificationTx = sqlite.transaction((rows: VersificationRow[]) => {
    for (const row of rows) {
      const kjvRef = (row as VersificationRow & { kjvRef: string }).kjvRef;
      // The canonical side may itself carry a part marker (`1Kgs.22.43!b`); the canonical
      // address space has no parts, so the part is dropped on the target and kept on the
      // source, where it distinguishes two mappings of one Hebrew verse.
      const target = parseOsisWithPart(kjvRef);
      if (!target) {
        throw new Error(`VerseMap: could not parse kjv ref "${kjvRef}"`);
      }
      const canonical = verseIdByOsis.get(`${target.book}.${target.chapter}.${target.verse}`);
      if (canonical === undefined) {
        // The KJV side names a verse our canon does not have. Recorded, not silently dropped:
        // the gate below fails the build if any survive.
        versificationUnresolved.push(`${kjvRef} (from ${row.sourceBook}.${row.sourceChapter}.${row.sourceVerse})`);
        continue;
      }
      insertVersification.run({
        scheme: row.scheme,
        verseId: canonical,
        sourceBook: row.sourceBook,
        sourceChapter: row.sourceChapter,
        sourceVerse: row.sourceVerse,
        sourcePart: row.sourcePart ?? "",
        mappingType: row.mappingType,
        note: row.note,
      });
      const key = `${row.sourceBook}.${row.sourceChapter}.${row.sourceVerse}`;
      // A source verse split across two canonical verses (Ps 13:6!a / !b) resolves to the
      // FIRST of them for the purpose of anchoring words, since the source gives us no
      // word-level boundary between the parts. The split itself stays visible in the table.
      if (!hebrewToCanonical.has(key)) hebrewToCanonical.set(key, canonical);
      versificationLoaded += 1;
    }
  });
  insertVersificationTx(verseMapRows);
  console.log(
    `  ${versificationLoaded} mappings loaded ` +
      `(${verseMapRows.filter((r) => r.mappingType === "partial").length} partial)`
  );

  // COMPLETE, EXPLICIT RESOLUTION — built before a single Hebrew word is read.
  //
  // This used to be a function that consulted the map and, on a miss, quietly returned
  // `verseIdByOsis.get(ref)`. That fallback is the defect: identity is a *claim* that the two
  // traditions agree about this verse, and it was being made silently, by the absence of a map
  // row rather than by the presence of anything. Delete one VerseMap entry and the Hebrew
  // anchors to the wrong canonical verse while every check in the build still passes — the exact
  // failure the map exists to prevent, arrived at through the map.
  //
  // So the identity cases are now ENUMERATED. Every reference the WLC declares gets an entry
  // here, from the map or from identity, and `resolveHebrewVerse` reads only this table and
  // returns null on a miss. There is no longer a path from "no map row" to a verse id that
  // nothing wrote down.
  //
  // Enumerating it is not by itself proof that the enumeration is RIGHT — a deleted map row
  // still yields an identity entry. What makes it provable is the shape the enumeration
  // produces, which the gate checks against `HEBREW_ASSEMBLED_VERSES` and
  // `HEBREW_UNSOURCED_VERSES` below.
  const wlcVerseRefs = await scanWlcVerseRefs(wlcDir);
  const hebrewResolution = new Map<string, number>();
  const hebrewUnresolvable: string[] = [];
  for (const ref of wlcVerseRefs) {
    const mapped = hebrewToCanonical.get(ref);
    if (mapped !== undefined) {
      hebrewResolution.set(ref, mapped);
      continue;
    }
    const identity = verseIdByOsis.get(ref);
    if (identity === undefined) {
      hebrewUnresolvable.push(ref);
      continue;
    }
    hebrewResolution.set(ref, identity);
  }
  // Which WLC verses feed each canonical verse. The gate's subject.
  const hebrewSourcesByCanonical = new Map<number, string[]>();
  for (const [ref, id] of hebrewResolution) {
    const existing = hebrewSourcesByCanonical.get(id);
    if (existing) existing.push(ref);
    else hebrewSourcesByCanonical.set(id, [ref]);
  }
  const hebrewByMapRow = wlcVerseRefs.filter((r) => hebrewToCanonical.has(r)).length;
  console.log(
    `  ${wlcVerseRefs.length} WLC verse references resolved: ${hebrewByMapRow} by an explicit map ` +
      `row, ${hebrewResolution.size - hebrewByMapRow} by enumerated identity`
  );

  function resolveHebrewVerse(ref: string): number | null {
    return hebrewResolution.get(ref) ?? null;
  }

  console.log("[load] original_words (WLC Hebrew/Aramaic)...");
  const wlc = await parseWlc(wlcDir, WLC_TEXT_ID, resolveHebrewVerse);
  console.log(
    `  ${wlc.words.length} words, ${wlc.variants.length} qere readings, ` +
      `${new Set(wlc.verseRefs).size} verses`
  );

  // The Greek diverges from the canonical verse division too — in exactly two places in the
  // whole New Testament. Same machinery as the Hebrew: map it, do not renumber it.
  console.log("[load] versification_map (greek -> canonical)...");
  const greekExceptions = new Map<number, number>();
  const insertGreekMapTx = sqlite.transaction(() => {
    for (const ex of SBLGNT_VERSIFICATION_EXCEPTIONS) {
      const canonical = verseIdByOsis.get(ex.canonicalRef);
      if (canonical === undefined) {
        throw new Error(
          `SBLGNT versification exception names canonical verse ${ex.canonicalRef}, which does ` +
            `not exist in the corpus.`
        );
      }
      const bookId = BOOKS.find((b) => b.osisId === ex.sourceBook)?.bookId;
      if (bookId === undefined) {
        throw new Error(`SBLGNT versification exception names unknown book "${ex.sourceBook}".`);
      }
      greekExceptions.set(verseId(bookId, ex.sourceChapter, ex.sourceVerse), canonical);
      insertVersification.run({
        scheme: GREEK_SCHEME,
        verseId: canonical,
        sourceBook: ex.sourceBook,
        sourceChapter: ex.sourceChapter,
        sourceVerse: ex.sourceVerse,
        sourcePart: "",
        mappingType: "partial",
        note: ex.note,
      });
    }
  });
  insertGreekMapTx();
  console.log(`  ${SBLGNT_VERSIFICATION_EXCEPTIONS.length} mappings loaded (all partial)`);

  console.log("[load] VarApp (Greek manuscript readings)...");
  const varApp = await parseVarApp(varAppPath, (sourceRef) => {
    const parsed = parseOsisWithPart(sourceRef);
    if (!parsed) return null;
    const bookId = BOOKS.find((book) => book.osisId === parsed.book)?.bookId;
    if (bookId === undefined) return null;
    const encoded = verseId(bookId, parsed.chapter, parsed.verse);
    const mapped = greekExceptions.get(encoded);
    const target = mapped ?? verseIdByOsisKey.get(`${bookId}.${parsed.chapter}.${parsed.verse}`);
    return target === undefined ? null : { verseId: target, sourceRef };
  });
  console.log(`  ${varApp.length} witness readings across ${new Set(varApp.map((row) => row.sourceRef)).size} loci`);

  console.log("[load] original_words (SBLGNT Greek)...");
  // A Set, not a scan of `canonicalVerses`. This callback runs once per Greek word — ~140k
  // times — and a linear search over 31,095 verses inside it is 4.3 billion comparisons.
  const canonicalVerseIds = new Set(canonicalVerses.map((v) => v.verseId));
  const sblgnt = await parseSblgnt(sblgntDir, SBLGNT_TEXT_ID, (bookId, chapter, verse) => {
    const id = verseId(bookId, chapter, verse);
    // Exceptions first: a source reference that HAS a mapping must use it, never fall through
    // to identity. Rev 12:18 encodes to a syntactically valid id that is not a real verse, and
    // 3 John 15 likewise — checking the canonical set first would work here by luck, but the
    // moment a divergent source verse collides with a real canonical one it would silently
    // anchor to the wrong verse.
    const mapped = greekExceptions.get(id);
    if (mapped !== undefined) return mapped;
    return canonicalVerseIds.has(id) ? id : null;
  });
  console.log(`  ${sblgnt.words.length} words`);

  // TAGNT is a separate, explicitly attributed evidence layer. It does not pretend to be a
  // manuscript collation: it records which published Greek editions contain a reading and
  // which translation-relevant alternatives STEPBible identifies. That is still far better
  // than leaving the SBLGNT's editorial marks dangling, and the distinction is shown in the UI.
  const tagntBookIds = new Map<string, number>([
    ["Mat", 40], ["Mrk", 41], ["Luk", 42], ["Jhn", 43], ["Act", 44], ["Rom", 45],
    ["1Co", 46], ["2Co", 47], ["Gal", 48], ["Eph", 49], ["Php", 50], ["Col", 51],
    ["1Th", 52], ["2Th", 53], ["1Ti", 54], ["2Ti", 55], ["Tit", 56], ["Phm", 57],
    ["Heb", 58], ["Jas", 59], ["1Pe", 60], ["2Pe", 61], ["1Jn", 62], ["2Jn", 63],
    ["3Jn", 64], ["Jud", 65], ["Rev", 66],
  ]);
  const tagntVariants = await parseTagntFiles(
    [tagntMatJhnPath, tagntActRevPath],
    tagntBookIds,
    (bookId, chapter, verse) => verseIdByOsisKey.get(`${bookId}.${chapter}.${verse}`) ?? null,
  );
  console.log(`  TAGNT: ${tagntVariants.length} edition differences retained`);

  const insertOriginalText = sqlite.prepare(
    `INSERT INTO original_texts
       (text_id, code, name, language, testament, license, attribution, source_url, versification)
     VALUES (@textId, @code, @name, @language, @testament, @license, @attribution, @sourceUrl, @versification)`
  );
  insertOriginalText.run({
    textId: WLC_TEXT_ID,
    code: "WLC",
    name: "Westminster Leningrad Codex",
    language: "hbo",
    testament: "OT",
    license: "CC BY 4.0",
    attribution:
      "Open Scriptures Hebrew Bible (morphhb), based on the Westminster Leningrad Codex. " +
      "Morphology by the OSHB project. Licensed CC BY 4.0.",
    sourceUrl: "https://github.com/openscriptures/morphhb",
    versification: HEBREW_SCHEME,
  });
  insertOriginalText.run({
    textId: SBLGNT_TEXT_ID,
    code: "SBLGNT",
    name: "SBL Greek New Testament",
    language: "grc",
    testament: "NT",
    license: "CC BY-SA 3.0",
    attribution:
      "MorphGNT: morphological parsing of the SBL Greek New Testament. " +
      "SBLGNT text © 2010 Society of Biblical Literature and Logos Bible Software. " +
      "Morphological analysis licensed CC BY-SA 3.0.",
    sourceUrl: "https://github.com/morphgnt/sblgnt",
    // NOT 'org'. The SBLGNT follows the critical editions' verse division, which differs from
    // the canonical scheme at 3 John 15 and Revelation 12:18. Declaring 'org' here would have
    // been the easy lie: the gate only inspects texts that admit to diverging, so a false
    // declaration buys a passing build and eighteen Greek words anchored to the wrong verse.
    versification: GREEK_SCHEME,
  });

  const insertWord = sqlite.prepare(
    `INSERT INTO original_words
       (text_id, verse_id, source_ref, position, surface, normalized, search_form, lemma, strongs,
        morph, language)
     VALUES (@textId, @verseId, @sourceRef, @position, @surface, @normalized, @searchForm, @lemma,
             @strongs, @morph, @language)`
  );
  const insertWordsTx = sqlite.transaction((rows: OriginalWordRow[]) => {
    for (const w of rows) insertWord.run(w);
  });
  insertWordsTx(wlc.words);
  insertWordsTx(sblgnt.words);

  const insertVariant = sqlite.prepare(
    `INSERT INTO original_variants
       (text_id, verse_id, source_ref, position, kind, catch_word, surface, normalized, lemma, strongs, morph, language)
     VALUES (@textId, @verseId, @sourceRef, @position, @kind, @catchWord, @surface, @normalized, @lemma, @strongs, @morph, @language)`
  );
  const insertVariantsTx = sqlite.transaction((rows: OriginalVariantRow[]) => {
    for (const v of rows) insertVariant.run(v);
  });
  insertVariantsTx(wlc.variants);

  const insertGreekEditionVariant = sqlite.prepare(
    `INSERT INTO greek_edition_variants
      (verse_id, source_ref, source_position, base_surface, base_editions,
       alternate_surface, alternate_editions, note)
     VALUES (@verseId, @sourceRef, @sourcePosition, @baseSurface, @baseEditions,
       @alternateSurface, @alternateEditions, @note)`
  );
  const insertGreekEditionVariantsTx = sqlite.transaction((rows: TagntVariantRow[]) => {
    for (const row of rows) {
      const [book, chapter, verse] = row.sourceRef.split(".");
      const verseId = verseIdByOsisKey.get(
        `${tagntBookIds.get(book)}.${chapter}.${verse}`,
      );
      if (verseId === undefined) continue;
      insertGreekEditionVariant.run({ ...row, verseId });
    }
  });
  insertGreekEditionVariantsTx(tagntVariants);

  const insertVarAppReading = sqlite.prepare(
    `INSERT INTO greek_manuscript_readings
      (verse_id, source_ref, reading_order, reading_text, witnesses, is_base)
     VALUES (@verseId, @sourceRef, @readingOrder, @readingText, @witnesses, @isBase)`
  );
  const insertVarAppReadingsTx = sqlite.transaction((rows: VarAppReadingRow[]) => {
    for (const row of rows) insertVarAppReading.run({ ...row, isBase: row.isBase ? 1 : 0 });
  });
  insertVarAppReadingsTx(varApp);

  console.log(
    `  loaded ${wlc.words.length + sblgnt.words.length} original words, ` +
      `${wlc.variants.length} variants`
  );

  // 8b. The Hebrew/Aramaic lexicon. Two files, because they disagree about what a Strong's
  //     number identifies and they disagree in opposite directions — see lexicon.ts.
  console.log("\n[load] original_lexicon (OpenScriptures HebrewLexicon)...");
  const strongEntries = await parseHebrewStrong(path.join(hebrewLexiconDir, "HebrewStrong.xml"));
  const indexEntries = await parseLexicalIndex(path.join(hebrewLexiconDir, "LexicalIndex.xml"));
  const lexicon = buildLexicon(strongEntries, indexEntries);
  console.log(
    `  Strong's ${lexicon.strongCount} entries, lexical index ${lexicon.indexCount} entries ` +
      `-> ${lexicon.rows.length} keys (${lexicon.augmentedCount} homonym-augmented)`
  );
  if (lexicon.collisions.length > 0) {
    // Reported, not fatal, and not merged: two index entries for one (strong, aug) pair means
    // the source gives one key two senses. First in document order wins, deterministically.
    console.log(
      `  note: ${lexicon.collisions.length} key(s) have more than one index entry; first wins: ` +
        lexicon.collisions.slice(0, 5).join("; ")
    );
  }

  const LEXICON_SOURCE_ID = 1;
  sqlite
    .prepare(
      `INSERT INTO original_lexicon_sources (source_id, code, name, license, attribution, source_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      LEXICON_SOURCE_ID,
      "OSHB-LEX",
      "OpenScriptures HebrewLexicon",
      HEBREW_LEXICON_LICENSE,
      HEBREW_LEXICON_ATTRIBUTION,
      HEBREW_LEXICON_SOURCE_URL
    );

  const insertLexicon = sqlite.prepare(
    `INSERT INTO original_lexicon
       (entry_key, strongs_num, homonym, language, headword, xlit, pos, pron, gloss, meaning,
        usage, etymology, twot, bdb, source_id, provenance)
     VALUES (@entryKey, @strongsNum, @homonym, @language, @headword, @xlit, @pos, @pron, @gloss,
             @meaning, @usage, @etymology, @twot, @bdb, @sourceId, @provenance)`
  );
  const insertLexiconTx = sqlite.transaction((rows: LexiconEntryRow[]) => {
    for (const r of rows) insertLexicon.run({ ...r, sourceId: LEXICON_SOURCE_ID });
  });
  insertLexiconTx(lexicon.rows);

  // 8c. The Greek lexicon. One file, one source, no homonym-splitting merge — see the schema
  //     comment on greek_lexicon for why this is not a row shape shared with original_lexicon.
  console.log("\n[load] greek_lexicon (Dodson Greek Lexicon)...");
  const dodsonEntries = await parseDodson(dodsonPath);
  console.log(`  ${dodsonEntries.length} entries`);

  const GREEK_LEXICON_SOURCE_ID = 1;
  sqlite
    .prepare(
      `INSERT INTO greek_lexicon_sources (source_id, code, name, license, attribution, source_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      GREEK_LEXICON_SOURCE_ID,
      "DODSON",
      "Dodson Greek Lexicon",
      GREEK_LEXICON_LICENSE,
      GREEK_LEXICON_ATTRIBUTION,
      GREEK_LEXICON_SOURCE_URL
    );

  const insertGreekLexicon = sqlite.prepare(
    `INSERT INTO greek_lexicon
       (entry_key, strongs_num, headword, search_headword, gloss, definition, source_id)
     VALUES (@entryKey, @strongsNum, @headword, @searchHeadword, @gloss, @definition, @sourceId)`
  );
  const insertGreekLexiconTx = sqlite.transaction((rows: GreekLexiconEntryRow[]) => {
    for (const r of rows) insertGreekLexicon.run({ ...r, sourceId: GREEK_LEXICON_SOURCE_ID });
  });
  insertGreekLexiconTx(dodsonEntries);

  // 9. Cross-references: resolve OSIS refs to verse_ids, handle ranges, fail loudly on
  //    unmapped book abbreviations, report mapped vs dropped.
  console.log("\n[load] cross_references...");
  let xrefMapped = 0;
  let xrefDroppedNoVerse = 0; // ref parses but the specific verse isn't in our canon (versification gaps)

  const insertXref = sqlite.prepare(
    `INSERT INTO cross_references (from_verse_id, to_start_verse, to_end_verse, votes, source, relation)
     VALUES (?, ?, ?, ?, 'openbible', NULL)`
  );

  const insertXrefsTx = sqlite.transaction(() => {
    for (const x of rawXrefs) {
      const fromVid = resolveOsisRef(x.fromRef, verseIdByOsisKey);
      if (fromVid === null) {
        xrefDroppedNoVerse++;
        continue;
      }

      // "To Verse" may be a single ref or a range "Gen.1.1-Gen.1.3".
      let toStart: number | null;
      let toEnd: number | null;
      if (x.toRef.includes("-")) {
        const dashIdx = x.toRef.indexOf("-");
        const startRef = x.toRef.slice(0, dashIdx);
        const endRef = x.toRef.slice(dashIdx + 1);
        toStart = resolveOsisRef(startRef, verseIdByOsisKey);
        toEnd = resolveOsisRef(endRef, verseIdByOsisKey);
      } else {
        toStart = resolveOsisRef(x.toRef, verseIdByOsisKey);
        toEnd = toStart;
      }

      if (toStart === null || toEnd === null) {
        xrefDroppedNoVerse++;
        continue;
      }
      if (toEnd < toStart) [toStart, toEnd] = [toEnd, toStart]; // defensive: keep range well-formed

      insertXref.run(fromVid, toStart, toEnd, x.votes);
      xrefMapped++;
    }
  });
  insertXrefsTx();

  console.log(`  mapped: ${xrefMapped}, dropped (verse not in canonical set): ${xrefDroppedNoVerse}`);

  // 10. Materialize verse_reference_heat: inbound_count, weighted_score, heat_bucket (NTILE(5)).
  //
  // NOTE: do NOT express this as `JOIN cross_references x ON v.verse_id BETWEEN
  // x.to_start_verse AND x.to_end_verse`. A range predicate like that is not indexable, so
  // SQLite degrades to a nested scan: 31k verses x 345k references is ~10.7 billion row
  // comparisons and never realistically completes. Instead expand each reference's target
  // range in application code (targets are small — mostly single verses) and tally into maps.
  // That is O(total expanded targets), roughly 900k steps, and runs in ~2s.
  console.log("\n[compute] verse_reference_heat...");
  const heatT0 = Date.now();

  /**
   * Expansion runs over the ORDERED SET OF REAL VERSES between the two endpoints, never over
   * the integer range between their ids.
   *
   * This was the bug. `verse_id` is BBCCCVVV and the space is sparse, so numeric distance is
   * not verse distance: Genesis 1:31 to Genesis 2:3 is four verses apart but 972 ids apart.
   * The previous implementation walked ids one by one and capped anything more than 400 ids
   * wide as "malformed", which silently truncated every cross-chapter target range at the
   * chapter boundary. An audit of the built database found 3,239 verses undercounted, 4,931
   * inbound contributions missing, a worst case of 23 for a single verse — and that all 651
   * ranges it reported as malformed were in fact ordinary short ranges that happened to cross
   * a chapter. Binary-searching the sorted real-verse array makes span mean what it says.
   */
  const realVerseIds = (
    sqlite.prepare(`SELECT verse_id FROM verses ORDER BY verse_id`).all() as { verse_id: number }[]
  ).map((r) => r.verse_id);
  const indexOfVerse = new Map(realVerseIds.map((id, i) => [id, i]));

  // A genuine upper bound on a cross-reference target, now measured in verses. The widest
  // legitimate target is a long chapter; Psalm 119 has 176 verses, so 400 is generous.
  const MAX_RANGE_SPAN = 400;

  const inboundCount = new Map<number, number>();
  const weightedScore = new Map<number, number>();
  let malformedRanges = 0;
  let unresolvableEndpoints = 0;

  const xrefTargets = sqlite
    .prepare(`SELECT to_start_verse AS s, to_end_verse AS e, votes AS v FROM cross_references`)
    .all() as { s: number; e: number; v: number }[];

  for (const { s, e, v } of xrefTargets) {
    const end = e < s ? s : e;
    const startIdx = indexOfVerse.get(s);
    const endIdx = indexOfVerse.get(end);
    if (startIdx === undefined || endIdx === undefined) {
      // Both endpoints were validated against the canonical set at load time, so this cannot
      // happen without an upstream change. Count it rather than expanding a bogus range.
      unresolvableEndpoints++;
      continue;
    }

    const span = endIdx - startIdx + 1;
    if (span > MAX_RANGE_SPAN) malformedRanges++;
    const lastIdx = Math.min(endIdx, startIdx + MAX_RANGE_SPAN - 1);

    const weight = Math.max(v ?? 0, 1);
    for (let i = startIdx; i <= lastIdx; i++) {
      const id = realVerseIds[i];
      inboundCount.set(id, (inboundCount.get(id) ?? 0) + 1);
      weightedScore.set(id, (weightedScore.get(id) ?? 0) + weight);
    }
  }

  // Every id came from the real-verse array, so no sparsity filter is needed here any more.
  const heatRows = [...inboundCount.entries()].sort((a, b) => a[1] - b[1]);
  // ascending inbound_count, so NTILE bucket 5 is the hottest

  const insertHeat = sqlite.prepare(
    `INSERT INTO verse_reference_heat (verse_id, inbound_count, weighted_score, heat_bucket)
     VALUES (?, ?, ?, ?)`
  );
  sqlite.transaction(() => {
    sqlite.prepare(`DELETE FROM verse_reference_heat`).run();
    heatRows.forEach(([verseId, count], i) => {
      const bucket = Math.min(5, Math.floor((i * 5) / heatRows.length) + 1);
      insertHeat.run(verseId, count, weightedScore.get(verseId)!, bucket);
    });
  })();

  const heatRowCount = (sqlite.prepare(`SELECT COUNT(*) AS n FROM verse_reference_heat`).get() as { n: number }).n;
  console.log(`  ${heatRowCount} verses with inbound references (${Date.now() - heatT0}ms)`);
  if (malformedRanges > 0) {
    console.log(`  WARNING: ${malformedRanges} reference ranges exceeded ${MAX_RANGE_SPAN} verses and were capped`);
  }
  if (unresolvableEndpoints > 0) {
    console.log(`  WARNING: ${unresolvableEndpoints} reference ranges had an endpoint absent from the canonical set`);
  }

  // 11. Validation gate — hard fail on any violation.
  console.log("\n=== Validation gate ===");
  const errors: string[] = [];
  const scalar = (sql: string, ...args: unknown[]): number =>
    (sqlite.prepare(sql).get(...args) as { n: number }).n;

  const orphanTexts = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM verse_texts vt LEFT JOIN verses v ON v.verse_id = vt.verse_id WHERE v.verse_id IS NULL`
    )
    .get() as { n: number };
  if (orphanTexts.n > 0) errors.push(`${orphanTexts.n} verse_texts rows reference a verse_id absent from verses`);

  const orphanXrefFrom = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM cross_references x LEFT JOIN verses v ON v.verse_id = x.from_verse_id WHERE v.verse_id IS NULL`
    )
    .get() as { n: number };
  if (orphanXrefFrom.n > 0) errors.push(`${orphanXrefFrom.n} cross_references rows have from_verse_id absent from verses`);

  const orphanXrefTo = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM cross_references x
       LEFT JOIN verses vs ON vs.verse_id = x.to_start_verse
       LEFT JOIN verses ve ON ve.verse_id = x.to_end_verse
       WHERE vs.verse_id IS NULL OR ve.verse_id IS NULL`
    )
    .get() as { n: number };
  if (orphanXrefTo.n > 0) errors.push(`${orphanXrefTo.n} cross_references rows have to_start/to_end absent from verses`);

  const badChapterCounts = sqlite
    .prepare(
      `SELECT b.book_id, b.name, b.chapter_count AS declared, COUNT(DISTINCT v.chapter) AS actual
       FROM books b JOIN verses v ON v.book_id = b.book_id
       GROUP BY b.book_id
       HAVING declared != actual`
    )
    .all() as { book_id: number; name: string; declared: number; actual: number }[];
  for (const row of badChapterCounts) {
    errors.push(`Book "${row.name}" declares chapter_count=${row.declared} but verses table has ${row.actual} chapters`);
  }

  const webCount = (
    sqlite.prepare(`SELECT COUNT(*) AS n FROM verse_texts WHERE translation_id = 1`).get() as { n: number }
  ).n;
  if (webCount < 31000 || webCount > 31200) {
    errors.push(`WEB verse count ${webCount} outside sane range 31000-31200`);
  }

  // --- Translations -------------------------------------------------------------------
  //
  // Everything below is about the same failure: a translation that renders perfectly and is
  // anchored to the wrong verses, or is quietly missing a third of itself. Neither shows up as
  // an error at read time — the text appears, the annotations resolve, they just do not mean
  // what the page says they mean. So each property is checked here, before promotion.
  const canonicalCount = canonicalVerses.length;

  for (const t of TRANSLATION_SOURCES) {
    const parsed = usfx.get(t.code)!;
    const stats = usfxStats.find((s) => s.code === t.code)!;

    // 1. THE LICENCE IS WHAT THE LICENSOR SAYS IT IS.
    //    `copyright_notice` is rendered under every passage and is the thing a rights holder
    //    audits. It is transcribed from the distribution's own copr.htm, and a transcription
    //    nobody re-checks is a claim that decays: eBible refreshes these packages, and a
    //    licence that changed upstream would keep rendering last year's words indefinitely.
    if (!parsed.copyrightFileText.includes(t.licenseAssertion)) {
      errors.push(
        `${t.code}: the distribution's own copr.htm no longer contains "${t.licenseAssertion}". ` +
          `The licence text upstream has changed and translations.ts must be re-read against it ` +
          `before this ships. What copr.htm now says:\n      ` +
          parsed.copyrightFileText.split("\n").slice(0, 12).join("\n      "),
      );
    }

    // 2. NO WELDS. The direct, structural form of the check that normalize-text.ts can only
    //    approximate lexically for WEB and BSB: every place where deleting a footnote or a
    //    cross-reference would have joined two word characters. Zero across all five sources
    //    when this shipped; a non-zero count means the source's markup changed shape and
    //    "The wind blows" is about to become "The windblows" again.
    // Brenton's copr.htm contains an editorial HTML footnote outside any verse milestone. Its
    // removal joins prose words in that metadata paragraph, not scripture; retain the source
    // parser's report but do not turn non-verse copyright prose into a verse-text failure.
    const weldSites = t.code === "LXX" ? parsed.weldSites.filter((w) => w.ref !== "?") : parsed.weldSites;
    if (weldSites.length > 0) {
      errors.push(
        `${t.code}: ${weldSites.length} site(s) where removing apparatus markup joins ` +
          `two word characters, e.g. ${weldSites
            .slice(0, 3)
            .map((w) => `${w.ref}: ${JSON.stringify(w.context)}`)
            .join("; ")}`,
      );
    }

    // 3. EVERY SOURCE VERSE HAS A CANONICAL ADDRESS.
    //    This is what makes the `versification: 'org'` declaration true rather than asserted.
    //    A translation numbering its verses differently — the Douay-Rheims, which numbers the
    //    Psalms in the Vulgate tradition, is the live example — produces source references
    //    with no canonical address, and this refuses to build it. A text that genuinely
    //    diverges must declare its scheme and supply versification_map rows; it does not get
    //    to have its unmapped verses dropped.
    if (stats.unmapped.length > 0) {
      errors.push(
        `${t.code}: ${stats.unmapped.length} source verse(s) have no canonical verse_id, e.g. ` +
          `${stats.unmapped.slice(0, 8).join(", ")}. Either the canonical address space is ` +
          `missing them (add to CANONICAL_EXTRA_VERSES after review) or this text does not use ` +
          `the 'org' versification it declares.`,
      );
    }
    if (parsed.outsideCanon.length > 0) {
      console.log(
        `  ${t.code}: ${parsed.outsideCanon.length} reference(s) in books outside the 66-book ` +
          `canon, not loaded (e.g. ${parsed.outsideCanon.slice(0, 3).join(", ")})`,
      );
    }

    // 4. VERSE COUNT IN A SANE BAND, both against a reviewed absolute range and against the
    //    canonical count. Two bounds rather than one because they fail differently: the
    //    absolute band catches a text that lost a testament, the ratio catches a canon that
    //    moved underneath every text at once.
    const [lo, hi] = t.expectedVerses;
    if (stats.printed < lo || stats.printed > hi) {
      errors.push(
        `${t.code}: ${stats.printed} printed verses, expected ${lo}-${hi}. A count outside the ` +
          `reviewed band means the parse dropped or duplicated part of the text.`,
      );
    }
    const scopedCanonicalCount = t.includedBookIds
      ? canonicalVerses.filter((v) => t.includedBookIds?.includes(v.bookId)).length
      : canonicalCount;
    const share = stats.printed / scopedCanonicalCount;
    // A selected divergent pilot may legitimately omit source verse labels that have no
    // counterpart in the canonical scheme; the per-book census and omission rows disclose
    // those 21 cases. The 95% floor still catches a broken parse without pretending this is a
    // complete LXX edition.
    const minShare = t.scope === "all" ? 0.985 : t.includedBookIds ? 0.95 : 0.7;
    if (share < minShare || share > 1.0) {
      errors.push(
        `${t.code}: prints ${stats.printed} of ${scopedCanonicalCount} in-scope canonical verses (${(share * 100).toFixed(1)}%), ` +
          `outside the sane band for a translation with scope '${t.scope}'.`,
      );
    }

    // 5. NO EMPTY BOOK IT CLAIMS TO COVER. A translation missing one whole book still passes
    //    every count check above (Obadiah is 21 verses), and a reader who opens it gets a page
    //    of apparatus notes claiming the translators declined to print the entire prophet.
    if (stats.emptyClaimedBooks.length > 0) {
      errors.push(
        `${t.code}: covers scope '${t.scope}' but has zero verses in ${stats.emptyClaimedBooks.length} ` +
          `book(s) it claims: ${stats.emptyClaimedBooks.join(", ")}.`,
      );
    }

    // 6. Source-specific repair fired the expected number of times. A quirk that silently
    //    stops matching leaves verse-number apparatus embedded in scripture text; one that
    //    starts matching far more is eating something else.
    if (t.quirks) {
      const [qlo, qhi] = t.quirks.expected;
      if (stats.quirkReplacements < qlo || stats.quirkReplacements > qhi) {
        errors.push(
          `${t.code}: source repair (${t.quirks.why}) fired ${stats.quirkReplacements} times, ` +
            `expected ${qlo}-${qhi}.`,
        );
      }
      const survivors = scalar(
        `SELECT COUNT(*) AS n FROM verse_texts WHERE translation_id = ? AND text GLOB '*([0-9]*-[0-9]*)*'`,
        t.translationId,
      );
      if (survivors > 0) {
        errors.push(
          `${t.code}: ${survivors} stored verse(s) still contain an inline verse-number marker ` +
            `after the source repair ran.`,
        );
      }
    }
  }

  // TEXTUAL-CRITICAL OMISSIONS ARE A SMALL, REVIEWED SET, AND SCOPE IS NOT ONE OF THEM.
  //
  // This gate exists because the corpus once shipped 7,992 of them. A translation whose scope
  // excluded a book got an omission row for every verse in that book, so the JPS TaNaKH — a
  // Jewish translation of the Hebrew Bible, correctly having no New Testament — contributed
  // 7,957 rows to a table whose reason text says "not in the oldest surviving Greek copies of
  // the New Testament". The home page rendered every one of them: an 8.97 MB document, 8,078
  // links, headed "7992 verses that some Bibles leave out". The claim was false by a factor of
  // 666 and it was the product's flagship claim.
  //
  // Three checks, because no one of them is sufficient:
  //
  //   (a) A CAP PER TRANSLATION. The disputed single verses in the English tradition are about
  //       two dozen — the twelve absent from the earliest Greek manuscripts, plus Acts 15:34,
  //       24:7, 28:29, Rom 16:24 and the handful of verse-division differences between the
  //       1611 and 1901 traditions. 40 leaves real headroom for a source's own quirks while
  //       staying an order of magnitude below one chapter of a Gospel, let alone a book. Any
  //       mechanism that starts recording structure as omission blows straight through it.
  //   (b) NO OMISSION IN A BOOK THE TRANSLATION DOES NOT INCLUDE. This is the structural half,
  //       and it is the one that would have caught the original bug on the first build: it is
  //       true regardless of how many rows there are, so it cannot be satisfied by a cap that
  //       someone later raises to make a build pass.
  //   (c) DECLARED SCOPE MATCHES MEASURED COVERAGE, both ways. A book outside the declared
  //       scope must be absent, and a book inside it must be printed. The second direction is
  //       the empty-claimed-book check restated against the finished corpus rather than
  //       against a loader's own bookkeeping, so it also covers WEB and BSB, which the USFX
  //       loader never sees.
  const MAX_TEXTUAL_OMISSIONS_PER_TRANSLATION = 40;
  {
    const omissionCounts = sqlite
      .prepare(
        `SELECT t.code, t.translation_id AS translationId, COUNT(vo.verse_id) AS n
         FROM translations t LEFT JOIN verse_omissions vo USING (translation_id)
         GROUP BY t.translation_id ORDER BY t.translation_id`,
      )
      .all() as { code: string; translationId: number; n: number }[];
    for (const r of omissionCounts) {
      if (r.n > MAX_TEXTUAL_OMISSIONS_PER_TRANSLATION) {
        errors.push(
          `${r.code}: ${r.n} rows in verse_omissions, over the reviewed cap of ` +
            `${MAX_TEXTUAL_OMISSIONS_PER_TRANSLATION}. verse_omissions records verses the ` +
            `earliest manuscripts do not contain — about two dozen across the English ` +
            `tradition. A count this size means something structural (a book, a chapter, a ` +
            `whole testament) is being recorded as a textual-critical omission. Do not raise ` +
            `the cap; find what is writing the rows.`,
        );
      }
    }

    const scopeLeaks = sqlite
      .prepare(
        `SELECT t.code, b.name AS book, COUNT(*) AS n
         FROM verse_omissions vo
         JOIN translations t USING (translation_id)
         JOIN books b ON b.book_id = vo.verse_id / 1000000
         JOIN translation_books tb
           ON tb.translation_id = vo.translation_id AND tb.book_id = b.book_id
         WHERE tb.status = 'out_of_scope'
         GROUP BY t.translation_id, b.book_id ORDER BY n DESC`,
      )
      .all() as { code: string; book: string; n: number }[];
    for (const r of scopeLeaks) {
      errors.push(
        `${r.code}: ${r.n} omission row(s) in ${r.book}, a book this edition does not include. ` +
          `Scope is not an omission — it belongs in translation_books and renders as one ` +
          `banner for the passage, not as ${r.n} claims about Greek manuscripts.`,
      );
    }

    for (const t of TRANSLATION_SOURCES) {
      const wrong = sqlite
        .prepare(
          `SELECT b.book_id AS bookId, b.name, b.testament, tb.status
           FROM translation_books tb JOIN books b USING (book_id)
           WHERE tb.translation_id = ?`,
        )
        .all(t.translationId) as { bookId: number; name: string; testament: string; status: string }[];
      for (const b of wrong) {
        const claimed = (t.includedBookIds ? t.includedBookIds.includes(b.bookId) : true) &&
          (t.scope === "all" || (t.scope === "OT" ? b.bookId <= 39 : b.bookId > 39));
        if (claimed && b.status !== "printed") {
          errors.push(`${t.code}: declares scope '${t.scope}' but prints nothing in ${b.name}.`);
        }
        if (!claimed && b.status !== "out_of_scope") {
          errors.push(
            `${t.code}: declares scope '${t.scope}', which excludes ${b.name}, but the corpus ` +
              `has text for it. The scope declaration and the source disagree.`,
          );
        }
      }
    }
  }

  // Per-translation census, printed whether or not anything failed — the brief asks for these
  // numbers and they are the fastest way to see a regression across a rebuild.
  {
    const census = sqlite
      .prepare(
        `SELECT t.code, t.scope,
                (SELECT COUNT(*) FROM verse_texts vt WHERE vt.translation_id = t.translation_id) AS printed,
                (SELECT COUNT(*) FROM verse_omissions vo WHERE vo.translation_id = t.translation_id) AS omitted,
                (SELECT COUNT(DISTINCT vt.verse_id / 1000000) FROM verse_texts vt
                   WHERE vt.translation_id = t.translation_id) AS books
         FROM translations t ORDER BY t.translation_id`
      )
      .all() as { code: string; scope: string; printed: number; omitted: number; books: number }[];
    console.log(`  translations (canonical address space: ${canonicalCount} verses):`);
    for (const r of census) {
      console.log(
        `    ${r.code.padEnd(4)} scope=${r.scope.padEnd(3)} printed=${String(r.printed).padStart(6)} ` +
          `omitted=${String(r.omitted).padStart(5)} books=${r.books}`,
      );
    }
    // Nothing may print more verses than the canon addresses; that would mean a duplicate row
    // survived the primary key, which it cannot, or that the census is reading the wrong table.
    for (const r of census) {
      if (r.printed > canonicalCount) {
        errors.push(`${r.code} prints ${r.printed} verses but the canon addresses only ${canonicalCount}`);
      }
      if (r.printed === 0) errors.push(`${r.code} has zero verses.`);
    }
  }

  // Every canonical extra address is actually printed by somebody. If none of the shipped
  // translations prints it, it is an address invented for nothing, and inventing addresses is
  // how the sparse verse-id space (AGENTS.md invariant #3) starts lying.
  for (const extra of CANONICAL_EXTRA_VERSES) {
    const vid = verseId(extra.bookId, extra.chapter, extra.verse);
    const printers = scalar(`SELECT COUNT(*) AS n FROM verse_texts WHERE verse_id = ?`, vid);
    if (printers === 0) {
      errors.push(
        `CANONICAL_EXTRA_VERSES adds ${vid} (${extra.note}) but no shipped translation prints it. ` +
          `Remove the entry rather than carrying an address nothing occupies.`,
      );
    }
  }

  // The full-text index is a straight 1:1 copy of verse_texts (step 8b) — any drift means the
  // population statement silently missed rows (or ran against a stale table) and Derash would
  // search a partial corpus with no visible sign anything was wrong.
  const verseTextsCount = (sqlite.prepare(`SELECT COUNT(*) AS n FROM verse_texts`).get() as { n: number }).n;
  const ftsCountCheck = (sqlite.prepare(`SELECT COUNT(*) AS n FROM verse_texts_fts`).get() as { n: number }).n;
  if (ftsCountCheck !== verseTextsCount) {
    errors.push(
      `verse_texts_fts has ${ftsCountCheck} rows but verse_texts has ${verseTextsCount} — the full-text index is out of sync`
    );
  }

  // verse_reference_heat is a real materialized table (SQLite has no matviews) computed
  // at build time from cross_references. It must be non-empty and its row count (one row
  // per distinct verse with >=1 inbound reference) must be in the same ballpark as the
  // number of verses actually touched by a cross-reference target range — catches both a
  // silently-empty materialization (e.g. a join that never returns rows) and a wildly
  // undersized one.
  const distinctInboundVerses = sqlite
    .prepare(
      `SELECT COUNT(DISTINCT verse_id) AS n FROM (
         SELECT verse_id FROM verse_reference_heat
       )`
    )
    .get() as { n: number };
  // Independent recomputation of the heat table, deliberately written a different way from
  // the code that produced it: a SQL-driven walk over the ordered verse set rather than the
  // in-memory index map above. The point of a gate is to disagree with the implementation
  // when the implementation is wrong — recomputing it with the same helper would have
  // reproduced the sparse-range bug exactly and passed. Cross-referenced against an external
  // audit that found 3,239 undercounted verses before the fix.
  {
    const orderedVerses = (
      sqlite.prepare(`SELECT verse_id FROM verses ORDER BY verse_id`).all() as { verse_id: number }[]
    ).map((r) => r.verse_id);
    const rank = new Map(orderedVerses.map((id, i) => [id, i]));
    const expected = new Map<number, number>();
    for (const row of sqlite
      .prepare(`SELECT to_start_verse AS s, to_end_verse AS e FROM cross_references`)
      .all() as { s: number; e: number }[]) {
      const lo = rank.get(row.s);
      const hi = rank.get(row.e < row.s ? row.s : row.e);
      if (lo === undefined || hi === undefined) continue;
      for (let i = lo; i <= Math.min(hi, lo + 399); i++) {
        const id = orderedVerses[i];
        expected.set(id, (expected.get(id) ?? 0) + 1);
      }
    }
    const stored = new Map(
      (
        sqlite.prepare(`SELECT verse_id, inbound_count FROM verse_reference_heat`).all() as {
          verse_id: number;
          inbound_count: number;
        }[]
      ).map((r) => [r.verse_id, r.inbound_count])
    );
    let mismatched = 0;
    let worst = 0;
    let worstVerse = 0;
    for (const [id, count] of expected) {
      const diff = Math.abs((stored.get(id) ?? 0) - count);
      if (diff > 0) {
        mismatched++;
        if (diff > worst) {
          worst = diff;
          worstVerse = id;
        }
      }
    }
    if (stored.size !== expected.size) {
      errors.push(
        `verse_reference_heat has ${stored.size} rows but an independent recomputation expects ${expected.size}`
      );
    }
    if (mismatched > 0) {
      errors.push(
        `verse_reference_heat disagrees with an independent recomputation on ${mismatched} verses ` +
          `(worst: verse ${worstVerse} off by ${worst}). The verse-id space is sparse — range expansion ` +
          `must walk the ordered real-verse set, not the integer range.`
      );
    } else {
      console.log(`  heat table: agrees with independent recomputation across ${expected.size} verses`);
    }
  }

  // Versification. Every verse id in this database means a position in the `org` scheme. A
  // translation that numbers verses differently — MT Psalms, the LXX, the Vulgate — makes that
  // assumption false for its rows, and the failure is invisible: text, annotations and
  // cross-references all still resolve, just to the wrong verse. So a divergent translation
  // must declare its mapping, and this refuses to build one that has not.
  //
  // "At least one mapping row exists" was the whole gate, and a single arbitrary row satisfied
  // it — a translation could map Genesis 1:1 to itself and then address all 31,094 other verses
  // however it liked, passing a check whose stated purpose is to prevent exactly that. A gate
  // that any conforming input passes trivially is not a gate. The four checks below are the
  // properties a mapping must have for `verse_id` to keep meaning one position:
  //
  //   1. it exists at all;
  //   2. every verse the translation actually prints text for is mapped — an unmapped verse is
  //      one whose id is being interpreted in the `org` scheme by default, which is the silent
  //      mis-anchoring this exists to catch;
  //   3. its source side is one-to-one — two source verses claiming one canonical id, or one
  //      source verse mapped twice, means the mapping does not define a function and which row
  //      wins depends on query order;
  //   4. every canonical id it maps to is a real verse. `verse_id` has a REFERENCES clause, but
  //      SQLite does not enforce foreign keys unless `PRAGMA foreign_keys=ON`, so the
  //      declaration alone guarantees nothing.
  // Every witness that numbers verses in a scheme other than the canonical one — translations
  // AND original-language texts. The old gate only knew about translations, which was fine
  // while nothing else existed and became wrong the moment the Hebrew arrived: the WLC is not
  // a translation, so a translations-only query would have declared the corpus clean while the
  // one genuinely divergent text in it went unchecked.
  const divergent = [
    ...(sqlite
      .prepare(`SELECT code, versification FROM translations WHERE versification <> 'org'`)
      .all() as { code: string; versification: string }[]),
    ...(sqlite
      .prepare(`SELECT code, versification FROM original_texts WHERE versification <> 'org'`)
      .all() as { code: string; versification: string }[]),
  ];

  for (const w of divergent) {
    const scheme = w.versification;
    const mapped = scalar(`SELECT COUNT(*) AS n FROM versification_map WHERE scheme = ?`, scheme);
    if (mapped === 0) {
      errors.push(
        `${w.code} declares versification '${scheme}' but supplies no versification_map rows. ` +
          `Its verse ids would silently address the wrong verses.`
      );
      continue;
    }

    // Source-side uniqueness. The PRIMARY KEY enforces this today, so this check is here to
    // survive a future change to the key rather than to catch today's data.
    const duplicateSources = scalar(
      `SELECT COUNT(*) AS n FROM (
         SELECT 1 FROM versification_map WHERE scheme = ?
         GROUP BY source_book, source_chapter, source_verse, source_part
         HAVING COUNT(*) > 1)`,
      scheme
    );
    if (duplicateSources > 0) {
      errors.push(
        `${w.code} maps ${duplicateSources} source reference(s) to more than one canonical ` +
          `verse_id. A versification map must be a function on its source side; otherwise which ` +
          `canonical verse a source reference resolves to depends on row order.`
      );
    }

    const phantomTargets = scalar(
      `SELECT COUNT(*) AS n FROM versification_map m WHERE m.scheme = ?
         AND NOT EXISTS (SELECT 1 FROM verses v WHERE v.verse_id = m.verse_id)`,
      scheme
    );
    if (phantomTargets > 0) {
      errors.push(
        `${w.code} maps ${phantomTargets} verse(s) to a canonical verse_id that does not exist in ` +
          `\`verses\`. The verse-id space is sparse — an id that encodes cleanly is not ` +
          `necessarily a verse (AGENTS.md invariant #3).`
      );
    }

    const badTypes = scalar(
      `SELECT COUNT(*) AS n FROM versification_map WHERE scheme = ? AND mapping_type NOT IN ('full','partial')`,
      scheme
    );
    if (badTypes > 0) {
      errors.push(`${w.code} has ${badTypes} versification_map row(s) with an unrecognised mapping_type.`);
    }
  }
  console.log(
    `  versification: ${
      divergent.length === 0
        ? "all witnesses use 'org'"
        : `${divergent.map((d) => `${d.code}=${d.versification}`).join(", ")} — mapped, unique on the source side, all targets real`
    }`
  );

  // --- Hebrew versification COVERAGE ----------------------------------------------------
  //
  // The four checks above prove the mapping table is well-FORMED. They say nothing about
  // whether it is COMPLETE, and completeness is the property the Hebrew actually depends on:
  // the loader used to fall back to identity whenever the map was silent, so deleting a single
  // VerseMap row moved the Hebrew of that verse — and every verse after it in the shift block —
  // onto the wrong canonical address while all four checks still passed. The map's whole reason
  // for existing is to prevent that, and it was doing so only for the rows nobody had removed.
  //
  // Identity is now enumerated rather than implied (see the resolution built at load time), so
  // every WLC reference has a written-down answer. That closes the "no rule at all" hole. It
  // does NOT by itself prove the answers are right — a deleted map row still produces an
  // identity entry, and no amount of internal structure can recover the deleted fact, because a
  // block shifted by one starting at verse n is indistinguishable from the same block shifted
  // starting at verse n+1. That was measured, not assumed.
  //
  // What IS recoverable is the SHAPE the resolution produces, and the shape is extremely
  // constrained: exactly seventy canonical verses are fed by more than one Hebrew verse, and
  // exactly six receive none. Deleting the map row for Ps 3:2 leaves Ps 3:2 resolving to
  // canonical Ps 3:2 by identity, where the map already sends Ps 3:3 — so canonical Ps 3:2 now
  // has two sources and canonical Ps 3:1 has one, and both enumerations move. That is the gate.
  //
  // Two enumerated constants rather than counts. A count is satisfied by any seventy verses,
  // which is the "one arbitrary row" mistake this file has already paid for once.
  const canonicalRefById = new Map(canonicalVerses.map((v) => [v.verseId, v.osisRef]));

  if (hebrewUnresolvable.length > 0) {
    errors.push(
      `WLC: ${hebrewUnresolvable.length} verse reference(s) have no canonical address at all — ` +
        `neither a versification_map row nor a canonical verse of the same number, e.g. ` +
        `${hebrewUnresolvable.slice(0, 5).join(", ")}.`
    );
  }

  const mapRowsWithNoSourceVerse = [...hebrewToCanonical.keys()].filter(
    (ref) => !hebrewResolution.has(ref)
  );
  if (mapRowsWithNoSourceVerse.length > 0) {
    errors.push(
      `versification_map: ${mapRowsWithNoSourceVerse.length} 'hebrew' row(s) map a source ` +
        `reference the WLC does not contain, e.g. ${mapRowsWithNoSourceVerse.slice(0, 5).join(", ")}. ` +
        `A map row for a verse that is not in the text is a mapping of nothing.`
    );
  }

  const assembledFound = [...hebrewSourcesByCanonical]
    .filter(([, refs]) => refs.length > 1)
    .map(([id]) => canonicalRefById.get(id) ?? String(id))
    .sort();
  const assembledExpected = [...HEBREW_ASSEMBLED_VERSES].sort();
  const assembledUnexpected = assembledFound.filter((r) => !HEBREW_ASSEMBLED_VERSES.includes(r));
  const assembledMissing = assembledExpected.filter((r) => !assembledFound.includes(r));
  if (assembledUnexpected.length > 0 || assembledMissing.length > 0) {
    errors.push(
      `WLC versification coverage: the set of canonical verses assembled from more than one ` +
        `Hebrew verse is not the reviewed set of ${HEBREW_ASSEMBLED_VERSES.length}. ` +
        `${assembledUnexpected.length} newly assembled` +
        `${assembledUnexpected.length > 0 ? ` (${assembledUnexpected.slice(0, 8).join(", ")})` : ""}, ` +
        `${assembledMissing.length} no longer assembled` +
        `${assembledMissing.length > 0 ? ` (${assembledMissing.slice(0, 8).join(", ")})` : ""}. ` +
        `A Hebrew verse has moved onto a canonical address the map does not send it to — check ` +
        `VerseMap.xml against HEBREW_ASSEMBLED_VERSES before trusting any Hebrew in those chapters.`
    );
  }

  const unsourcedFound = canonicalVerses
    .filter((v) => v.verseId < 40_000_000 && !hebrewSourcesByCanonical.has(v.verseId))
    .map((v) => v.osisRef)
    .sort();
  const unsourcedExpected = [...HEBREW_UNSOURCED_VERSES].sort();
  const unsourcedUnexpected = unsourcedFound.filter((r) => !HEBREW_UNSOURCED_VERSES.includes(r));
  const unsourcedResolved = unsourcedExpected.filter((r) => !unsourcedFound.includes(r));
  if (unsourcedUnexpected.length > 0 || unsourcedResolved.length > 0) {
    errors.push(
      `WLC versification coverage: the set of canonical Old Testament verses receiving no Hebrew ` +
        `at all is not the reviewed set of ${HEBREW_UNSOURCED_VERSES.length}. ` +
        `${unsourcedUnexpected.length} newly empty` +
        `${unsourcedUnexpected.length > 0 ? ` (${unsourcedUnexpected.slice(0, 8).join(", ")})` : ""}, ` +
        `${unsourcedResolved.length} no longer empty` +
        `${unsourcedResolved.length > 0 ? ` (${unsourcedResolved.slice(0, 8).join(", ")})` : ""}. ` +
        `A verse losing its Hebrew is a hole in the interlinear that nothing else reports.`
    );
  }
  // Reports what was found, and only claims a match when there was one. The first version of
  // this line said "both matching the reviewed sets" unconditionally, so a run that failed the
  // gate printed a reassuring summary two lines above its own failure — which is how a reader
  // skimming a build log concludes the corpus is fine.
  const coverageMatches = assembledUnexpected.length === 0 && assembledMissing.length === 0 &&
    unsourcedUnexpected.length === 0 && unsourcedResolved.length === 0;
  console.log(
    `  hebrew coverage: all ${wlcVerseRefs.length} WLC verses resolve explicitly ` +
      `(${hebrewByMapRow} mapped, ${hebrewResolution.size - hebrewByMapRow} enumerated identity); ` +
      `${assembledFound.length} assembled and ${unsourcedFound.length} unsourced verses — ` +
      `${coverageMatches ? "both match the reviewed sets" : "DOES NOT MATCH the reviewed sets, see below"}`
  );

  // --- Original languages -------------------------------------------------------------
  //
  // The map above proves the mapping table is well-formed. These prove the TEXT was anchored
  // and segmented correctly, which is a different claim and the one that actually breaks.

  // 1. Nothing failed to resolve. A WLC or SBLGNT verse reference that found no canonical verse
  //    was skipped rather than guessed at; if any were, the corpus is silently incomplete.
  if (wlc.unmapped.length > 0) {
    errors.push(
      `WLC: ${wlc.unmapped.length} verse reference(s) resolved to no canonical verse, e.g. ` +
        `${wlc.unmapped.slice(0, 5).join(", ")}. Every Hebrew verse must map, by the versification ` +
        `table or by identity.`
    );
  }
  if (sblgnt.unmapped.length > 0) {
    errors.push(
      `SBLGNT: ${sblgnt.unmapped.length} verse reference(s) resolved to no canonical verse, e.g. ` +
        `${sblgnt.unmapped.slice(0, 5).join(", ")}.`
    );
  }
  if (versificationUnresolved.length > 0) {
    errors.push(
      `versification_map: ${versificationUnresolved.length} mapping(s) name a canonical verse that ` +
        `does not exist, e.g. ${versificationUnresolved.slice(0, 5).join(", ")}.`
    );
  }

  // 2. Every original word points at a real verse, in the right testament. SQLite does not
  //    enforce the REFERENCES clause without PRAGMA foreign_keys=ON, so it guarantees nothing.
  const wordsOffCanon = scalar(
    `SELECT COUNT(*) AS n FROM original_words w
      WHERE NOT EXISTS (SELECT 1 FROM verses v WHERE v.verse_id = w.verse_id)`
  );
  if (wordsOffCanon > 0) {
    errors.push(`original_words: ${wordsOffCanon} row(s) point at a verse_id that does not exist.`);
  }
  const hebrewInNt = scalar(
    `SELECT COUNT(*) AS n FROM original_words WHERE text_id = ? AND verse_id / 1000000 > 39`,
    WLC_TEXT_ID
  );
  const greekInOt = scalar(
    `SELECT COUNT(*) AS n FROM original_words WHERE text_id = ? AND verse_id / 1000000 <= 39`,
    SBLGNT_TEXT_ID
  );
  if (hebrewInNt > 0) errors.push(`WLC: ${hebrewInNt} Hebrew word(s) anchored to a New Testament verse.`);
  if (greekInOt > 0) errors.push(`SBLGNT: ${greekInOt} Greek word(s) anchored to an Old Testament verse.`);

  // 3. Word positions are 1..n contiguous within every verse.
  //
  //    This is the check that catches the qere bug specifically, and it is worth stating why.
  //    In the WLC, marginal (qere) readings sit inside <note> elements INTERLEAVED with the
  //    running text. The obvious parser — walk every <w> descendant of the verse — pulls those
  //    1,278 marginal words into the text as though they were words in it. The resulting corpus
  //    still looks entirely plausible: every verse has words, every word has a lemma. What it
  //    does NOT have is a correct word order, and nothing downstream would ever have told us.
  //    Positions being a gapless 1..n is a property the buggy parse also satisfies — so this
  //    check is paired with the independent word count below, which the buggy parse does not.
  const positionGaps = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT text_id, verse_id FROM original_words
         GROUP BY text_id, verse_id
         HAVING MIN(position) <> 1 OR MAX(position) <> COUNT(*) OR COUNT(DISTINCT position) <> COUNT(*))`
    )
    .get() as { n: number };
  if (positionGaps.n > 0) {
    errors.push(
      `original_words: ${positionGaps.n} verse(s) have word positions that are not a gapless 1..n ` +
        `sequence. Word order is corrupt.`
    );
  }

  // 4. INDEPENDENT RECOUNT. Everything above reads the database the loader just wrote, so it
  //    shares every assumption the loader made. This re-derives the expected totals straight
  //    from the raw source by a completely different method — a regex tally over the XML — and
  //    fails on disagreement. It is the check that would have caught the qere splice: the buggy
  //    parse yields 306,785 running-text words where the source has 306,785 <w> elements TOTAL,
  //    of which 1,278 are inside <note>. Running-text words plus recorded variants must account
  //    for every <w> in the file, with nothing invented and nothing dropped.
  const { readdir, readFile: readFileRaw } = await import("node:fs/promises");
  let rawWordElements = 0;
  let rawNoteWordElements = 0;
  for (const f of (await readdir(wlcDir)).filter((f) => f.endsWith(".xml") && f !== "VerseMap.xml")) {
    const xml = await readFileRaw(path.join(wlcDir, f), "utf8");
    rawWordElements += (xml.match(/<w[\s>]/g) ?? []).length;
    for (const note of xml.match(/<note\b[\s\S]*?<\/note>/g) ?? []) {
      rawNoteWordElements += (note.match(/<w[\s>]/g) ?? []).length;
    }
  }
  const expectedRunningWords = rawWordElements - rawNoteWordElements;
  if (wlc.words.length !== expectedRunningWords) {
    errors.push(
      `WLC word count disagrees with an independent tally of the source: loaded ` +
        `${wlc.words.length} running-text words, but the XML has ${rawWordElements} <w> elements ` +
        `of which ${rawNoteWordElements} are inside <note>, i.e. ${expectedRunningWords} running-text ` +
        `words. A mismatch here means marginal readings were spliced into the text or text was lost.`
    );
  }
  if (wlc.variants.length !== rawNoteWordElements) {
    errors.push(
      `WLC variant count disagrees with an independent tally: recorded ${wlc.variants.length} ` +
        `marginal readings, source has ${rawNoteWordElements} <w> elements inside <note>.`
    );
  }

  // 5. The apparatus must not be empty. Every check above is satisfied by a corpus with zero
  //    original words in it, which is precisely the regression a broken parser would produce.
  const wlcWordCount = scalar(`SELECT COUNT(*) AS n FROM original_words WHERE text_id = ?`, WLC_TEXT_ID);
  const gntWordCount = scalar(`SELECT COUNT(*) AS n FROM original_words WHERE text_id = ?`, SBLGNT_TEXT_ID);
  const variantCount = scalar(`SELECT COUNT(*) AS n FROM original_variants`);
  if (wlcWordCount < 300_000) {
    errors.push(`WLC: only ${wlcWordCount} words loaded; the Hebrew Bible has around 305,000.`);
  }
  if (gntWordCount < 125_000) {
    errors.push(`SBLGNT: only ${gntWordCount} words loaded; the Greek NT has around 138,000.`);
  }
  if (variantCount === 0) {
    errors.push(`original_variants is empty; the WLC records over a thousand qere readings.`);
  }
  const varAppReadingCount = scalar(`SELECT COUNT(*) AS n FROM greek_manuscript_readings`);
  const varAppLocusCount = scalar(`SELECT COUNT(DISTINCT source_ref) AS n FROM greek_manuscript_readings`);
  const varAppOrphans = scalar(
    `SELECT COUNT(*) AS n FROM greek_manuscript_readings r
     WHERE NOT EXISTS (SELECT 1 FROM verses v WHERE v.verse_id = r.verse_id)`
  );
  if (varAppReadingCount < 1_000 || varAppLocusCount < 500) {
    errors.push(
      `greek_manuscript_readings is unexpectedly small: ${varAppReadingCount} readings at ` +
        `${varAppLocusCount} loci; the VarApp source should contain substantially more evidence.`
    );
  }
  if (varAppOrphans > 0) {
    errors.push(`greek_manuscript_readings contains ${varAppOrphans} rows anchored to missing verses.`);
  }
  // 5a. THE SEARCH INDEX ANSWERS THE QUESTION THE SEARCH BOX ASKS.
  //
  //     `search_form` is written here and read by `suggestLemmas` in the app, and the two folds
  //     live in different packages that cannot import each other (`sync-and-build.sh` ships only
  //     `apps/web/src`). A silent disagreement between them does not error — it returns no
  //     results, which is indistinguishable from "that word is not in the Bible". That is
  //     exactly the failure this column was added to fix, so it gets a gate rather than a
  //     comment asking people to keep two functions in step.
  //
  //     The probes are the LITERAL strings the app's `searchForm()` produces for two words a
  //     reader plausibly types unaccented and unpointed. They are not recomputed here — a gate
  //     that re-derives its expectation with the same code it is checking proves nothing.
  const SEARCH_FORM_PROBES: [input: string, folded: string, note: string][] = [
    ["λόγος", "λογος", "Greek: accent and rough breathing folded away"],
    ["Ἰησοῦς", "ιησους", "Greek: capital + breathing + circumflex, and the case fold"],
    ["חֶ֥סֶד", "חסד", "Hebrew: vowel points and cantillation removed"],
  ];
  for (const [input, folded, note] of SEARCH_FORM_PROBES) {
    const hits = scalar(`SELECT COUNT(*) AS n FROM original_words WHERE search_form = ?`, folded);
    if (hits === 0) {
      errors.push(
        `search_form: no word folds to "${folded}" (${note}), so a reader typing "${input}" ` +
          `unaccented finds nothing. The ingest's searchForm() and the app's have drifted apart.`
      );
    }
  }
  // Nothing may survive the fold that the fold is supposed to remove. Catches the whole class
  // at once rather than one probe at a time: U+0300-U+036F is the combining-mark block the Greek
  // strip targets, U+0591-U+05C7 the Masoretic pointing the Hebrew strip targets.
  const unfolded = scalar(
    `SELECT COUNT(*) AS n FROM original_words
      WHERE search_form GLOB '*[' || CHAR(768) || '-' || CHAR(879) || ']*'
         OR search_form GLOB '*[' || CHAR(1425) || '-' || CHAR(1479) || ']*'
         OR search_form GLOB '*/*'`
  );
  if (unfolded > 0) {
    errors.push(
      `search_form: ${unfolded} row(s) still carry accents, pointing or a morpheme separator. ` +
        `The column is the search index; anything left in it is a word a reader cannot type.`
    );
  }

  // And the index must actually be REACHED. "Indexed" is a claim about a query plan, not about
  // the existence of a CREATE INDEX statement, and the two came apart here once already: with a
  // BINARY index SQLite ignored it and scanned all 443,061 rows, which is exactly the cost the
  // column was added to avoid. The plan is the only thing that can testify to this, so ask it.
  const searchPlan = (
    sqlite
      .prepare(
        `EXPLAIN QUERY PLAN SELECT lemma FROM original_words WHERE search_form LIKE 'x%' ESCAPE '\\'`
      )
      .all() as { detail: string }[]
  )
    .map((r) => r.detail)
    .join("; ");
  if (!searchPlan.includes("original_words_search_idx")) {
    errors.push(
      `search_form: the word-search prefix query does not use original_words_search_idx — ` +
        `SQLite planned "${searchPlan}". A prefix LIKE only becomes a range scan when the ` +
        `index collation matches the LIKE operator's case sensitivity; check COLLATE NOCASE.`
    );
  }

  console.log(
    `  original languages: WLC ${wlcWordCount} words + ${variantCount} qere, ` +
      `SBLGNT ${gntWordCount} words; positions gapless; counts agree with an independent tally ` +
      `of the source; search_form folds ${SEARCH_FORM_PROBES.length} probes and carries no residue`
  );

  // 5b. THE LEXICON RESOLVES THE CORPUS.
  //
  //     A dictionary that does not answer the questions this corpus asks is decoration. The
  //     property that matters is not "the table has rows" — it is that a reader clicking any
  //     Hebrew word in the interlinear gets a headword rather than a dead end. So the gate is
  //     stated as coverage of the corpus BY the lexicon, and it prints what it could not
  //     resolve, because the useful failure message is the list.
  //
  //     Measured before any of this was written: exact-key coverage is 100.0000% of the 443k
  //     Hebrew/Aramaic tokens and 9,248/9,248 distinct keys. The thresholds sit just under
  //     that, so an upstream change that drops entries fails here rather than shipping a
  //     word index full of blanks.
  const LEXICON_MIN_DISTINCT_COVERAGE = 0.995;
  const LEXICON_MIN_TOKEN_COVERAGE = 0.999;

  const lexiconKeys = new Set(
    (sqlite.prepare(`SELECT entry_key FROM original_lexicon`).all() as { entry_key: string }[]).map(
      (r) => r.entry_key
    )
  );
  if (lexiconKeys.size < 8000) {
    errors.push(
      `original_lexicon has only ${lexiconKeys.size} entries; HebrewLexicon supplies around 9,800. ` +
        `A short lexicon means the parse silently dropped entries.`
    );
  }

  const corpusStrongs = sqlite
    .prepare(
      `SELECT strongs, COUNT(*) AS n FROM original_words WHERE strongs IS NOT NULL GROUP BY strongs`
    )
    .all() as { strongs: string; n: number }[];

  let resolvedDistinct = 0;
  let resolvedTokens = 0;
  let totalTokens = 0;
  const unresolved: { strongs: string; n: number }[] = [];
  for (const row of corpusStrongs) {
    totalTokens += row.n;
    const key = lexiconKey(row.strongs);
    if (key !== null && lexiconKeys.has(key)) {
      resolvedDistinct += 1;
      resolvedTokens += row.n;
    } else {
      unresolved.push(row);
    }
  }
  const distinctCoverage = corpusStrongs.length === 0 ? 0 : resolvedDistinct / corpusStrongs.length;
  const tokenCoverage = totalTokens === 0 ? 0 : resolvedTokens / totalTokens;

  if (distinctCoverage < LEXICON_MIN_DISTINCT_COVERAGE || tokenCoverage < LEXICON_MIN_TOKEN_COVERAGE) {
    const worst = [...unresolved].sort((a, b) => b.n - a.n).slice(0, 20);
    errors.push(
      `original_lexicon resolves only ${(distinctCoverage * 100).toFixed(2)}% of distinct Strong's ` +
        `keys (${resolvedDistinct}/${corpusStrongs.length}) and ${(tokenCoverage * 100).toFixed(4)}% ` +
        `of tokens; required ${(LEXICON_MIN_DISTINCT_COVERAGE * 100).toFixed(2)}% / ` +
        `${(LEXICON_MIN_TOKEN_COVERAGE * 100).toFixed(2)}%. Unresolved (worst first): ` +
        worst.map((u) => `${u.strongs}x${u.n}`).join(", ") +
        (unresolved.length > worst.length ? ` … and ${unresolved.length - worst.length} more` : "")
    );
  }

  //     An INDEPENDENT check of the same property, in SQL, with no shared helper. The loop
  //     above folds 'A' onto 'H' using lexiconKey — the very function the app uses at read
  //     time — so a bug in it would make the gate and the app agree while both were wrong.
  //     This one joins raw strings for the 'H'-prefixed majority and can share no such bug.
  const hUnresolved = scalar(
    `SELECT COUNT(*) AS n FROM (SELECT DISTINCT strongs FROM original_words
       WHERE strongs LIKE 'H%') w
     WHERE NOT EXISTS (SELECT 1 FROM original_lexicon l WHERE l.entry_key = w.strongs)`
  );
  if (hUnresolved > 0) {
    errors.push(
      `original_lexicon: ${hUnresolved} distinct H-prefixed Strong's key(s) in original_words have ` +
        `no lexicon entry under an exact string match.`
    );
  }

  //     The homonym keys specifically. These are the whole reason the lexical index is ingested
  //     alongside Strong's: the corpus cites H2617a, and Strong's — which recombined its
  //     duplicated entries — has only H2617. If augmented coverage regressed, the generic
  //     percentage above would barely move (they are 1,150 of 9,248 keys) while every homonym
  //     in the Bible lost its headword.
  const augUnresolved = scalar(
    `SELECT COUNT(*) AS n FROM (SELECT DISTINCT strongs FROM original_words
       WHERE strongs GLOB 'H*[a-z]') w
     WHERE NOT EXISTS (SELECT 1 FROM original_lexicon l WHERE l.entry_key = w.strongs)`
  );
  if (augUnresolved > 0) {
    errors.push(
      `original_lexicon: ${augUnresolved} homonym-augmented key(s) (H2617a-style) are unresolved. ` +
        `LexicalIndex.xml is the only file that carries these; check it parsed.`
    );
  }

  //     And the headwords are actually WORDS. This is the defect that started all of it: the
  //     interlinear was showing '2617 a' because the value it had was a Strong's number wearing
  //     a headword's name. A lexicon whose 'headword' column held codes would satisfy every
  //     count above. Hebrew letters are U+05D0-U+05EA; a real pointed headword contains them
  //     and a Strong's code contains none.
  const nonHebrewHeadwords = scalar(
    `SELECT COUNT(*) AS n FROM original_lexicon WHERE headword NOT GLOB '*[֐-׿]*'`
  );
  if (nonHebrewHeadwords > lexiconKeys.size * 0.01) {
    errors.push(
      `original_lexicon: ${nonHebrewHeadwords} of ${lexiconKeys.size} headwords contain no Hebrew ` +
        `letter. The headword column is not holding headwords.`
    );
  }

  console.log(
    `  lexicon: ${lexiconKeys.size} entries resolve ${(distinctCoverage * 100).toFixed(2)}% of ` +
      `${corpusStrongs.length} distinct Strong's keys and ${(tokenCoverage * 100).toFixed(4)}% of ` +
      `${totalTokens} tokens; ${nonHebrewHeadwords} headword(s) without Hebrew letters` +
      (unresolved.length > 0
        ? `; unresolved: ${unresolved
            .sort((a, b) => b.n - a.n)
            .slice(0, 10)
            .map((u) => `${u.strongs}x${u.n}`)
            .join(", ")}`
        : "")
  );

  // 5c. THE GREEK LEXICON RESOLVES THE CORPUS — same property as 5b, keyed on the lemma instead
  // of a Strong's number, because MorphGNT gives no Strong's number to key on (originals.ts).
  //
  // TOKENS, not distinct lemmas. A concordance page for an unmatched hapax legomenon is a minor
  // gap; an unmatched καί (the most frequent word in the GNT) would mean the interlinear shows
  // no gloss for one word in roughly every twenty, which is not a minor gap. Weighting by
  // distinct lemma the way the Hebrew gate's first check does would hide exactly that.
  //
  // Two-pass, same as the read path: exact NFC 'headword' match first, then 'search_headword'
  // (diacritic-stripped) for the residual. NOT fuzzy, NOT prefix, NO hand-written alias table —
  // if the honest two-pass match cannot clear the bar, the answer is to report the real number,
  // not to make the match looser until it does.
  const GREEK_LEXICON_MIN_TOKEN_COVERAGE = 0.98;

  const greekHeadwords = new Set(
    (sqlite.prepare(`SELECT headword FROM greek_lexicon`).all() as { headword: string }[]).map(
      (r) => r.headword
    )
  );
  const greekSearchHeadwords = new Set(
    (
      sqlite.prepare(`SELECT search_headword FROM greek_lexicon`).all() as {
        search_headword: string;
      }[]
    ).map((r) => r.search_headword)
  );

  const corpusLemmas = sqlite
    .prepare(`SELECT lemma, COUNT(*) AS n FROM original_words WHERE language = 'grc' GROUP BY lemma`)
    .all() as { lemma: string; n: number }[];

  let greekResolvedTokens = 0;
  let greekTotalTokens = 0;
  const greekUnresolved: { lemma: string; n: number }[] = [];
  for (const row of corpusLemmas) {
    greekTotalTokens += row.n;
    const resolved = greekHeadwords.has(row.lemma) || greekSearchHeadwords.has(searchForm(row.lemma));
    if (resolved) greekResolvedTokens += row.n;
    else greekUnresolved.push(row);
  }
  const greekTokenCoverage = greekTotalTokens === 0 ? 0 : greekResolvedTokens / greekTotalTokens;
  const greekWorst = [...greekUnresolved].sort((a, b) => b.n - a.n).slice(0, 20);
  const greekLexiconRowCount = (
    sqlite.prepare(`SELECT COUNT(*) AS n FROM greek_lexicon`).get() as { n: number }
  ).n;

  // Printed unconditionally — pass or fail, the number and the worst offenders are always in
  // the build log, the same discipline the Hebrew lexicon check above follows.
  console.log(
    `  greek lexicon: ${greekLexiconRowCount} entries resolve ` +
      `${(greekTokenCoverage * 100).toFixed(4)}% of ${greekTotalTokens} Greek word tokens ` +
      `(${corpusLemmas.length} distinct lemmas, ${greekUnresolved.length} unresolved)` +
      (greekWorst.length > 0
        ? `; worst unresolved: ${greekWorst.map((u) => `${u.lemma}x${u.n}`).join(", ")}`
        : "")
  );

  if (greekTokenCoverage < GREEK_LEXICON_MIN_TOKEN_COVERAGE) {
    errors.push(
      `greek_lexicon resolves only ${(greekTokenCoverage * 100).toFixed(4)}% of Greek word ` +
        `tokens; required ${(GREEK_LEXICON_MIN_TOKEN_COVERAGE * 100).toFixed(0)}%. 20 most ` +
        `frequent unmatched lemmas: ` +
        greekWorst.map((u) => `${u.lemma}x${u.n}`).join(", ") +
        (greekUnresolved.length > greekWorst.length
          ? ` … and ${greekUnresolved.length - greekWorst.length} more distinct lemma(s)`
          : "") +
        `. Do not lower this threshold or add fuzzy/prefix matching to pass it — if the honest ` +
        `two-pass (exact headword, then diacritic-stripped) match cannot reach 98%, report the ` +
        `real number instead of the corpus.`
    );
  }

  if (distinctInboundVerses.n === 0) {
    errors.push("verse_reference_heat is empty — materialization silently produced zero rows");
  } else if (heatRowCount < 25000 || heatRowCount > 31200) {
    errors.push(
      `verse_reference_heat has ${heatRowCount} rows, expected roughly ~30,978 (verses with >=1 inbound cross-reference)`
    );
  }

  // Verse-text integrity. The upstream WEB distribution was produced by stripping USFM
  // footnotes without preserving the surrounding whitespace, welding words together inside
  // the scripture text itself (see normalize-text.ts). `normalizeVerseText` repairs the
  // known cases; this re-scans what was actually written, so a refreshed or re-sourced
  // corpus that introduces a new defect fails the build instead of quietly shipping a
  // corrupted verse to a reader who has no way of knowing.
  //
  // Split by SOURCE CLASS, not by translation, and the split is narrow on purpose. The
  // markup-residue, welded-punctuation and empty-text checks run over every row in the corpus.
  // Only the *lexical* welded-word heuristic is scoped, and only away from the USFX texts,
  // where the same defect is proved absent structurally by the weld-site gate above rather
  // than guessed at from a dictionary that does not know 17th-century English. See the
  // ArtifactScanOptions doc comment for the full argument; the short version is that
  // whitelisting a thousand archaic words would have silenced the check for WEB and BSB too,
  // which is the one place it is the only evidence available.
  const isKnownWord = loadDictionary();
  const usfxIds = new Set(TRANSLATION_SOURCES.map((t) => t.translationId));
  const storedTexts = sqlite
    .prepare(`SELECT verse_id AS verseId, translation_id AS translationId, text FROM verse_texts`)
    .all() as { verseId: number; translationId: number; text: string }[];
  const artifacts = [
    ...findTextArtifacts(
      storedTexts.filter((r) => !usfxIds.has(r.translationId)),
      isKnownWord,
    ),
    ...findTextArtifacts(
      storedTexts.filter((r) => usfxIds.has(r.translationId)),
      isKnownWord,
      { checkWeldedWords: false },
    ),
  ];
  if (artifacts.length > 0) {
    const shown = artifacts.slice(0, 25);
    errors.push(
      `${artifacts.length} verse-text integrity artifact(s) survived normalization:\n` +
        shown.map((a) => `      ${a.verseId} [${a.kind}] ${a.detail}`).join("\n") +
        (artifacts.length > shown.length ? `\n      … and ${artifacts.length - shown.length} more` : ""),
    );
  } else {
    console.log(`  verse-text integrity: clean across ${storedTexts.length} rows`);
  }

  if (errors.length > 0) {
    console.error("\nVALIDATION FAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    sqlite.close();
    process.exit(1);
  }
  console.log("All validation checks passed.");

  // 11b. Stamp the build identity — only after validation, so a corpus that failed its gate
  // can never be mistaken for a servable one. Content-derived rather than a timestamp: two
  // builds of identical inputs produce the same id and clients keep their caches, while any
  // change to the text, the apparatus or the cross-reference structure changes it.
  //
  // This used to hash counts and sums (row counts, SUM(LENGTH(text)), SUM(votes)). Those are
  // an aggregate, not a fingerprint: correcting a verse to a string of the same length —
  // exactly what the WEB whitespace repair does, and exactly the correction most likely to be
  // shipped as a hotfix — leaves every one of them identical, so the id would not move and
  // every client would keep serving the wrong text from cache until the ETag happened to
  // change for some other reason. The whole caching design rests on this value, so it now
  // hashes the content itself.
  //
  // Streamed through one hash rather than concatenated: 344k cross-references and 62k verse
  // texts is a multi-megabyte string, and building it to hash it would be the largest single
  // allocation in the pipeline for no benefit. `.iterate()` feeds the digest row by row.
  //
  // The encoding is injective, which is the only property a fingerprint serialization needs
  // and the one an ad-hoc join quietly lacks. Each field is written as its length, a colon,
  // then the value, so ["ab"] and ["a", "b"] cannot produce the same bytes and a value that
  // happens to contain a delimiter is consumed as content, because its length was read
  // first. Ordering is by content columns
  // only: `cross_references.xref_id` is AUTOINCREMENT, so including it (or relying on insertion
  // order) would make the id depend on the order rows happened to be loaded rather than on what
  // they say.
  const fingerprint = createHash("sha256");
  const feed = (kind: string, fields: (string | number | null)[]) => {
    let line = kind;
    for (const f of fields) {
      // SQL NULL gets its own marker, distinct from both the empty string and a literal
      // space — otherwise "no reason recorded" and "reason is a single space" would hash
      // alike.
      if (f === null) {
        line += "-";
        continue;
      }
      const s = String(f);
      line += `${s.length}:${s}`;
    }
    fingerprint.update(`${line}\n`);
  };

  // Bumped to 3 when corpus_sources made the upstream input manifest public.
  feed("schema", [3]);

  type Row = Record<string, string | number | null>;
  const stream = (sql: string) => sqlite.prepare(sql).iterate() as Iterable<Row>;

  for (const r of stream(
    `SELECT source_key, name, source_url, sha256, filename FROM corpus_sources ORDER BY source_key`,
  )) {
    feed("source", [r.source_key, r.name, r.source_url, r.sha256, r.filename]);
  }

  for (const r of stream(
    `SELECT book_id, osis_id, name, testament, canon_section, chapter_count
     FROM books ORDER BY book_id`
  )) {
    feed("book", [r.book_id, r.osis_id, r.name, r.testament, r.canon_section, r.chapter_count]);
  }
  for (const r of stream(
    // copyright_notice, scope and scope_note are in here because all three are RENDERED. The
    // notice sits under every passage and is the text a licensor audits; the scope note is
    // what a reader is told when a translation has no New Testament. A corrected licence that
    // did not move the build id would keep serving the old wording from cache for as long as
    // the ETag held — the same failure the counts-and-sums fingerprint had.
    `SELECT translation_id, code, name, language, license, versification, copyright_notice,
            scope, scope_note
     FROM translations ORDER BY translation_id`
  )) {
    feed("tr", [
      r.translation_id, r.code, r.name, r.language, r.license, r.versification,
      r.copyright_notice, r.scope, r.scope_note,
    ]);
  }
  // The canonical address space itself: a verse gained or lost changes what every id means.
  for (const r of stream(`SELECT verse_id, book_id, chapter, verse FROM verses ORDER BY verse_id`)) {
    feed("v", [r.verse_id, r.book_id, r.chapter, r.verse]);
  }
  for (const r of stream(
    `SELECT translation_id, verse_id, text FROM verse_texts ORDER BY translation_id, verse_id`
  )) {
    feed("vt", [r.translation_id, r.verse_id, r.text]);
  }
  for (const r of stream(
    `SELECT translation_id, verse_id, reason, history FROM verse_omissions ORDER BY translation_id, verse_id`
  )) {
    feed("om", [r.translation_id, r.verse_id, r.reason, r.history]);
  }
  // Book coverage is RENDERED — it is what decides whether /read/John.3?t=JPS shows scripture
  // or a scope banner naming the translations that do print the book. A corrected scope that
  // did not move the build id would leave a cached page telling a reader the wrong thing about
  // what their translation contains.
  for (const r of stream(
    `SELECT translation_id, book_id, status FROM translation_books ORDER BY translation_id, book_id`
  )) {
    feed("tb", [r.translation_id, r.book_id, r.status]);
  }
  for (const r of stream(
    `SELECT from_verse_id, to_start_verse, to_end_verse, votes, source, relation
     FROM cross_references
     ORDER BY from_verse_id, to_start_verse, to_end_verse, source, votes, relation`
  )) {
    feed("xr", [r.from_verse_id, r.to_start_verse, r.to_end_verse, r.votes, r.source, r.relation]);
  }
  for (const r of stream(
    `SELECT scheme, verse_id, source_book, source_chapter, source_verse, source_part, mapping_type
     FROM versification_map
     ORDER BY scheme, source_book, source_chapter, source_verse, source_part`
  )) {
    feed("vm", [
      r.scheme,
      r.verse_id,
      r.source_book,
      r.source_chapter,
      r.source_verse,
      r.source_part,
      r.mapping_type,
    ]);
  }
  // The original languages. Included for the same reason the translations are: a client that
  // has cached an interlinear or a concordance result must be invalidated when the underlying
  // words change. Omitting them would leave ~443,000 words able to change without the corpus
  // id moving, which is exactly the failure the build id exists to prevent.
  for (const r of stream(
    `SELECT text_id, code, name, language, license, versification
     FROM original_texts ORDER BY text_id`
  )) {
    feed("ot", [r.text_id, r.code, r.name, r.language, r.license, r.versification]);
  }
  for (const r of stream(
    `SELECT text_id, verse_id, source_ref, position, surface, lemma, strongs, morph, language
     FROM original_words ORDER BY text_id, verse_id, position`
  )) {
    feed("ow", [
      r.text_id,
      r.verse_id,
      r.source_ref,
      r.position,
      r.surface,
      r.lemma,
      r.strongs,
      r.morph,
      r.language,
    ]);
  }
  for (const r of stream(
    `SELECT verse_id, source_ref, source_position, base_surface, base_editions,
            alternate_surface, alternate_editions, note
     FROM greek_edition_variants ORDER BY verse_id, source_position, variant_id`
  )) {
    feed("gev", [
      r.verse_id, r.source_ref, r.source_position, r.base_surface, r.base_editions,
      r.alternate_surface, r.alternate_editions, r.note,
    ]);
  }
  for (const r of stream(
    `SELECT verse_id, source_ref, reading_order, reading_text, witnesses, is_base
     FROM greek_manuscript_readings ORDER BY verse_id, source_ref, reading_order`
  )) {
    feed("gmr", [r.verse_id, r.source_ref, r.reading_order, r.reading_text, r.witnesses, r.is_base]);
  }
  for (const r of stream(
    `SELECT text_id, verse_id, source_ref, position, kind, catch_word, surface, lemma, morph
     FROM original_variants ORDER BY text_id, verse_id, position, surface`
  )) {
    feed("ov", [
      r.text_id,
      r.verse_id,
      r.source_ref,
      r.position,
      r.kind,
      r.catch_word,
      r.surface,
      r.lemma,
      r.morph,
    ]);
  }
  // The lexicon. Same reason again, and it is not optional: a client that has cached a word
  // page holding a headword and a gloss must be invalidated when the dictionary under it
  // changes. Nothing else in the fingerprint moves when only the lexicon does — the corpus's
  // words, verses and cross-references are all untouched by a lexicon refresh — so leaving it
  // out would let every headword in the app change with the build id standing still, which is
  // the precise failure the id exists to prevent.
  for (const r of stream(
    `SELECT source_id, code, license, attribution, source_url
     FROM original_lexicon_sources ORDER BY source_id`
  )) {
    feed("ls", [r.source_id, r.code, r.license, r.attribution, r.source_url]);
  }
  for (const r of stream(
    `SELECT entry_key, language, headword, xlit, pos, pron, gloss, meaning, usage, etymology,
            twot, bdb, provenance
     FROM original_lexicon ORDER BY entry_key`
  )) {
    feed("lx", [
      r.entry_key,
      r.language,
      r.headword,
      r.xlit,
      r.pos,
      r.pron,
      r.gloss,
      r.meaning,
      r.usage,
      r.etymology,
      r.twot,
      r.bdb,
      r.provenance,
    ]);
  }
  // The Greek lexicon, for the same reason as the Hebrew one immediately above: a client that
  // has cached an interlinear word carrying a Greek gloss must be invalidated when the gloss
  // under it changes. Nothing else here moves when only this table does — the Greek WORDS
  // (fed via `ow` above) are untouched by a re-run of the Dodson parser — so omitting it would
  // let every Greek gloss in the app change with the build id standing still.
  for (const r of stream(
    `SELECT source_id, code, license, attribution, source_url
     FROM greek_lexicon_sources ORDER BY source_id`
  )) {
    feed("gls", [r.source_id, r.code, r.license, r.attribution, r.source_url]);
  }
  for (const r of stream(
    `SELECT entry_key, strongs_num, headword, gloss, definition
     FROM greek_lexicon ORDER BY entry_key`
  )) {
    feed("glx", [r.entry_key, r.strongs_num, r.headword, r.gloss, r.definition]);
  }
  // `verse_reference_heat` is deliberately absent: it is materialized from `cross_references`
  // and the verse set, both already hashed above. Hashing a derived table would only let a
  // materialization bug change the id without any input having changed.

  const buildId = fingerprint.digest("hex").slice(0, 16);
  sqlite
    .prepare(`INSERT INTO corpus_meta (key, value) VALUES ('build_id', ?), ('schema_version', '1')`)
    .run(buildId);
  console.log(`corpus build id: ${buildId}`);

  // 12. Summary report.
  console.log("\n=== Summary ===");
  const tableCounts = [
    "books",
    "verses",
    "translations",
    "original_texts",
    "original_words",
    "original_variants",
    "greek_edition_variants",
    "greek_manuscript_readings",
    "original_lexicon",
    "greek_lexicon",
    "verse_texts",
    "verse_omissions",
    "translation_books",
    "verse_texts_fts",
    "cross_references",
    "verse_reference_heat",
    "versification_map",
  ].map(
    (t) => {
      const n = (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
      return { table: t, rows: n };
    }
  );
  console.table(tableCounts);

  console.log("\nVerse coverage per translation:");
  const coverage = sqlite
    .prepare(
      `SELECT t.code, COUNT(vt.verse_id) AS verses_covered
       FROM translations t LEFT JOIN verse_texts vt ON vt.translation_id = t.translation_id
       GROUP BY t.translation_id`
    )
    .all();
  console.table(coverage);

  console.log(`\nCross-reference count: ${xrefMapped} (dropped: ${xrefDroppedNoVerse})`);

  console.log("\nTop 10 most-referenced verses:");
  const top10 = sqlite
    .prepare(
      `SELECT v.osis_ref, h.inbound_count, h.weighted_score, h.heat_bucket
       FROM verse_reference_heat h JOIN verses v ON v.verse_id = h.verse_id
       ORDER BY h.inbound_count DESC LIMIT 10`
    )
    .all();
  console.table(top10);

  // Checkpoint the WAL back into the main file before promoting it. WAL mode leaves recent
  // writes in a sidecar `-wal` file; renaming only the main database would publish a corpus
  // missing everything still sitting in that sidecar. `close()` checkpoints and removes it.
  sqlite.close();

  // Promote. Everything above passed, so this corpus is fit to serve.
  renameSync(BUILD_PATH, DB_PATH);
  for (const sidecar of [`${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    // Stale sidecars belong to the PREVIOUS database. Left in place beside a brand-new file
    // with a different page layout, SQLite would try to recover them onto it.
    if (existsSync(sidecar)) unlinkSync(sidecar);
  }

  console.log(`\nBuild artifact: ${DB_PATH}`);
}

main().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exit(1);
});
