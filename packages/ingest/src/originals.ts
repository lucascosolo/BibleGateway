// Parsers for the original-language sources: the Westminster Leningrad Codex (Hebrew/Aramaic,
// via OpenScriptures morphhb) and the SBL Greek New Testament (via MorphGNT).
//
// Both are word-level texts: every word carries a lemma and a morphology code. That is the
// whole point of adding them — it is what makes lemma concordance and morphological search
// possible, and it is the single thing two adversarial reviews named as the reason Jot was
// not yet a research instrument.
//
// Design rule throughout: **store what the source says, verbatim.** Morphology codes are kept
// exactly as written (`HR/Ncfsa`, `----NSF-`); Strong's homonym letters are part of the
// identifier and are never stripped; the `/` morpheme segmentation in the Hebrew is preserved
// because it is information, not noise. Expanding a code into English is a *presentation*
// concern and lives in the app, so a decoding bug is fixable without a re-ingest and a
// researcher can always see the raw code.

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sax from "sax";

// --- Row shapes -----------------------------------------------------------------------

export interface OriginalWordRow {
  textId: number;
  /** Canonical (`org`) verse address. For the Hebrew this is the *mapped* id — see verse-map. */
  verseId: number;
  /**
   * The source's OWN reference for this word's verse (`Ps.51.2`), never renumbered.
   *
   * Load-bearing for a Hebrew text, not a debugging aid. Seventy canonical verses receive the
   * words of TWO Hebrew verses, because the Hebrew numbers a psalm superscription that English
   * leaves unnumbered. Storing only the canonical id would silently discard the Hebrew address
   * for those words — and the Hebrew numbering is the scholarly address, the one a commentary
   * or a critical edition cites. docs/ORIGINAL-LANGUAGES.md is explicit: do not resolve the
   * divergence by renumbering the Hebrew; the map exists so both can be true at once.
   */
  sourceRef: string;
  /**
   * 1-based word order within the CANONICAL verse.
   *
   * Numbered per canonical verse rather than per source verse: where two Hebrew verses merge
   * into one canonical verse, the second continues the first's numbering instead of restarting
   * at 1 and colliding with it. `sourceRef` is what preserves the distinction between them.
   */
  position: number;
  surface: string;
  normalized: string;
  /**
   * The form the word-search index is built on: unpointed, unaccented, lower-cased.
   *
   * Stored rather than computed, and that is the whole point of it. `normalized` cannot serve:
   * for the Hebrew it is already unpointed, but MorphGNT's `normalized` is fully accented, so a
   * search for `λογος` matched nothing while `λόγος` matched — a silent partial failure at
   * exactly the query a reader is most likely to type. Stripping in SQL instead would fix the
   * answer and defeat every index, which is 443,061 expression evaluations per keystroke. The
   * fold belongs where it can be indexed, which is here.
   *
   * `normalized` stays untouched beside it: it is what the source says, and the design rule of
   * this file is that the source's own values are stored verbatim.
   */
  searchForm: string;
  lemma: string;
  strongs: string | null;
  morph: string;
  /** ISO 639-3: 'hbo' Hebrew, 'arc' Aramaic, 'grc' Greek. */
  language: string;
}

/**
 * A reading the source records *beside* the running text rather than in it.
 *
 * In the WLC this is the **qere** — the Masoretic "as read" reading noted in the margin
 * against the **ketiv**, the consonantal text "as written". It is the oldest continuously
 * transmitted critical apparatus there is, and it ships inside the same file as the text.
 *
 * It has to be a separate table rather than extra words, because in the XML these sit inside
 * `<note type="variant">` elements *interleaved with the running text*. Walking every `<w>`
 * descendant of a verse — the obvious implementation — splices 1,278 marginal readings into
 * the text as though they were words in it, which corrupts every word position after the
 * first one in the verse and silently inflates the corpus.
 */
export interface OriginalVariantRow {
  textId: number;
  verseId: number;
  /** The source's own reference for the verse this reading sits in. See OriginalWordRow. */
  sourceRef: string;
  /** Word position this reading attaches to (the preceding running-text word). */
  position: number;
  /** 'qere' — the only kind the WLC marks. */
  kind: string;
  /** The ketiv as the note cites it: the written form this reading replaces. */
  catchWord: string | null;
  surface: string;
  normalized: string;
  lemma: string;
  strongs: string | null;
  morph: string;
  language: string;
}

/** One row of a source scheme's disagreement with the canonical (`org`) verse division. */
export interface VersificationRow {
  scheme: string;
  verseId: number;
  sourceBook: string;
  sourceChapter: number;
  sourceVerse: number;
  /** The `!a` / `!b` part marker where a source verse straddles a canonical boundary. */
  sourcePart: string | null;
  /** 'full' — the whole verse corresponds; 'partial' — only part of it does. */
  mappingType: string;
  note: string | null;
}

// --- Hebrew normalization -------------------------------------------------------------

/**
 * Strip pointing, cantillation and segmentation to leave the bare consonantal skeleton.
 *
 * U+0591–U+05C7 covers the whole apparatus the Masoretes added to the consonants: accents
 * (U+0591–U+05AF), vowel points (U+05B0–U+05BC), meteg/maqaf/paseq/sof-pasuq and the
 * shin/sin dots. Removing that range leaves exactly the letters U+05D0–U+05EA, which is the
 * form a researcher is matching on when they search unpointed. The `/` morpheme separator
 * goes too — it is our source's editorial mark, not part of the word.
 */
export function normalizeHebrew(surface: string): string {
  return surface.replace(/[֑-ׇ]/g, "").replace(/\//g, "").trim();
}

/**
 * The indexed search form of a word, for either script.
 *
 * One function rather than one per language, because the *query* side cannot know which script
 * was typed and must not have to guess. Each fold is a no-op on the other script: Hebrew points
 * live in U+0591–U+05C7 and are not combining marks in U+0300–U+036F, and Greek accents are not
 * in the Hebrew range. Applying both unconditionally is what lets one indexed column answer
 * `λογος` and `חסד` alike.
 *
 * NFD splits every Greek accent, breathing and iota subscript off its base letter into
 * U+0300–U+036F; the replace deletes them; `toLowerCase` runs last so `Ἰησοῦ` folds the same way
 * `ἰησοῦ` does.
 *
 * **This is the index half of a pair.** The query half is `searchForm()` in
 * `apps/web/src/lib/db/originals.ts`. They cannot share a module — `apps/web` and
 * `packages/ingest` are separate installs and `sync-and-build.sh` ships only `apps/web/src` — so
 * the ingest's validation gate re-derives a known probe against the loaded column instead. A
 * drift between the two fails the corpus build rather than silently returning no results.
 */
export function searchForm(surface: string): string {
  return normalizeHebrew(surface)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * The head lemma of a WLC lemma string.
 *
 * WLC lemmas encode the whole word's morphemes: `c/d/776` is conjunction + article +
 * Strong's 776 (*ʾereṣ*, "earth"). The prefixed particles are morphemes, not Strong's
 * entries, so the concordance key is the LAST segment. A homonym letter is part of the
 * identifier — `1254 a` and `1254 b` are different verbs — so it is kept and only the
 * internal space is closed up.
 *
 * Returns null for a lemma whose head is not a Strong's number (a handful of WLC lemmas are
 * editorial codes rather than dictionary references); the caller keeps the verbatim lemma
 * either way.
 */
export function hebrewStrongs(lemma: string, language: string): string | null {
  const head = lemma.split("/").pop()?.trim();
  if (!head) return null;
  const m = /^(\d+)\s*([a-z])?$/.exec(head);
  if (!m) return null;
  // 'H' for Hebrew, 'A' for Aramaic — the convention Strong's-aware tools use, and what a
  // user types into a search box. Prefixing makes the number globally unique against Greek.
  const prefix = language === "arc" ? "A" : "H";
  return `${prefix}${m[1]}${m[2] ?? ""}`;
}

// --- WLC (Hebrew/Aramaic) --------------------------------------------------------------

const WLC_BOOKS_EXPECTED = 39;

interface WlcParseResult {
  words: OriginalWordRow[];
  variants: OriginalVariantRow[];
  /** Every distinct WLC verse reference seen, in document order, as `Book.C.V`. */
  verseRefs: string[];
}

/**
 * Streams one WLC OSIS book file, yielding running-text words and marginal readings apart.
 *
 * SAX rather than a DOM: the file set is 20MB, but more importantly the distinction that
 * matters here is *positional* — a `<w>` counts as running text only when no `<note>` is open
 * above it. A streaming parser models that with a depth counter; a DOM walk invites exactly
 * the `.iter('w')` mistake described on OriginalVariantRow.
 */
async function parseWlcBook(
  filePath: string,
  textId: number,
  resolveVerse: (ref: string) => number | null,
  onUnmapped: (ref: string) => void,
  /** Running word count per CANONICAL verse, shared across books. See OriginalWordRow.position. */
  positionByVerse: Map<number, number>
): Promise<WlcParseResult> {
  const words: OriginalWordRow[] = [];
  const variants: OriginalVariantRow[] = [];
  const verseRefs: string[] = [];

  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: false, normalize: false });

    let sourceRef: string | null = null;
    let verseId: number | null = null;
    let position = 0;

    let noteDepth = 0;
    let noteKind: string | null = null;
    let catchWord: string | null = null;
    let inCatchWord = false;

    // Attributes of the <w> currently open, plus its accumulating text content. WLC splits a
    // word's text across child nodes in places, so text is gathered until the tag closes.
    let word: { lemma: string; morph: string } | null = null;
    let wordText = "";

    parser.on("error", (err) => reject(err));

    parser.on("opentag", (node) => {
      const name = node.name.replace(/^.*:/, "");
      const attr = node.attributes as Record<string, string>;

      switch (name) {
        case "verse": {
          const osisId = attr.osisID;
          if (!osisId) break;
          // A `<verse>` may carry several ids (`Gen.1.1 Gen.1.2`) where the source merges
          // them; take the first as the anchor and record each so coverage checks see them.
          sourceRef = osisId.split(/\s+/)[0];
          verseId = resolveVerse(sourceRef);
          if (verseId === null) onUnmapped(sourceRef);
          verseRefs.push(sourceRef);
          // Deliberately NOT `position = 0`. Where two Hebrew verses map onto one canonical
          // verse, restarting here makes the second verse's first word collide with the
          // first's — which is exactly what the UNIQUE constraint caught.
          break;
        }
        case "note":
          noteDepth += 1;
          noteKind = attr.type ?? null;
          catchWord = null;
          break;
        case "catchWord":
          inCatchWord = true;
          catchWord = "";
          break;
        case "rdg":
          // `type="x-qere"` marks the read-aloud form. Keep the source's own label.
          noteKind = attr.type ? attr.type.replace(/^x-/, "") : noteKind;
          break;
        case "w":
          word = { lemma: attr.lemma ?? "", morph: attr.morph ?? "" };
          wordText = "";
          break;
      }
    });

    parser.on("text", (t) => {
      if (inCatchWord) catchWord = (catchWord ?? "") + t;
      else if (word) wordText += t;
    });

    parser.on("closetag", (rawName) => {
      const name = rawName.replace(/^.*:/, "");

      if (name === "catchWord") {
        inCatchWord = false;
        return;
      }
      if (name === "note") {
        noteDepth = Math.max(0, noteDepth - 1);
        if (noteDepth === 0) noteKind = null;
        return;
      }
      if (name !== "w" || !word) return;

      const surface = wordText.trim();
      const current = word;
      word = null;
      wordText = "";

      if (verseId === null || surface === "") return;

      // The morph code's leading letter is the language: H = Hebrew, A = Aramaic. Daniel and
      // Ezra are partly Aramaic; recording it per word rather than per book is the only way
      // that is true at the granularity it actually varies.
      const language = current.morph.startsWith("A") ? "arc" : "hbo";
      const strongs = hebrewStrongs(current.lemma, language);
      const normalized = normalizeHebrew(surface);

      if (noteDepth > 0) {
        // A marginal reading. Attach it to the word it stands beside — the last running-text
        // word emitted in this canonical verse. Position 0 means the note precedes any word.
        variants.push({
          textId,
          verseId,
          sourceRef: sourceRef ?? "",
          position: positionByVerse.get(verseId) ?? 0,
          kind: noteKind === "variant" || noteKind === null ? "qere" : noteKind,
          catchWord: catchWord?.trim() || null,
          surface,
          normalized,
          lemma: current.lemma,
          strongs,
          morph: current.morph,
          language,
        });
        return;
      }

      const position = (positionByVerse.get(verseId) ?? 0) + 1;
      positionByVerse.set(verseId, position);
      words.push({
        textId,
        verseId,
        sourceRef: sourceRef ?? "",
        position,
        surface,
        normalized,
        searchForm: searchForm(surface),
        lemma: current.lemma,
        strongs,
        morph: current.morph,
        language,
      });
    });

    parser.on("end", () => resolve({ words, variants, verseRefs }));
    createReadStream(filePath, { encoding: "utf8" }).pipe(parser);
  });
}

/**
 * Every verse reference the WLC book files declare, by a regex pre-scan of the `osisID`
 * attributes.
 *
 * Deliberately a second, cruder pass over the same 20MB the SAX parser walks, and deliberately
 * BEFORE it. Two reasons, both load-bearing.
 *
 * The first is ordering: the caller has to build a complete source-to-canonical resolution
 * *before* a single word is read, or it is back to resolving each reference as it arrives and
 * falling back to identity when the map is silent — which is precisely the hole this exists to
 * close. You cannot enumerate the identity cases without first knowing every reference that
 * needs one.
 *
 * The second is independence: the coverage gate compares this list against the map, and a gate
 * that reused the SAX parser's own output would share every assumption the parser makes. The
 * repo has been bitten by exactly that before (see the cross-reference heat recount).
 *
 * A `<verse>` may carry several ids (`Gen.1.1 Gen.1.2`) where the source merges them; each is
 * returned, because each is a reference that must resolve.
 */
export async function scanWlcVerseRefs(wlcDir: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(wlcDir))
    .filter((f) => f.endsWith(".xml") && f !== "VerseMap.xml")
    .sort();

  const seen = new Set<string>();
  const refs: string[] = [];
  for (const f of files) {
    const xml = await readFile(path.join(wlcDir, f), "utf8");
    for (const m of xml.matchAll(/<verse[^>]*\bosisID="([^"]+)"/g)) {
      for (const id of m[1].split(/\s+/)) {
        if (id === "" || seen.has(id)) continue;
        seen.add(id);
        refs.push(id);
      }
    }
  }
  return refs;
}

export async function parseWlc(
  wlcDir: string,
  textId: number,
  resolveVerse: (ref: string) => number | null
): Promise<WlcParseResult & { unmapped: string[] }> {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(wlcDir))
    .filter((f) => f.endsWith(".xml") && f !== "VerseMap.xml")
    .sort();

  if (files.length !== WLC_BOOKS_EXPECTED) {
    throw new Error(
      `WLC: expected ${WLC_BOOKS_EXPECTED} book files, found ${files.length}. ` +
        `The source layout changed; check the parser before trusting the corpus.`
    );
  }

  const words: OriginalWordRow[] = [];
  const variants: OriginalVariantRow[] = [];
  const verseRefs: string[] = [];
  const unmapped: string[] = [];
  // Shared across books so a canonical verse assembled from two source verses keeps one
  // continuous word sequence. Books never share a canonical verse, so this is equivalent to a
  // per-book map — it is shared because correctness should not depend on that being true.
  const positionByVerse = new Map<number, number>();

  for (const f of files) {
    const r = await parseWlcBook(
      path.join(wlcDir, f),
      textId,
      resolveVerse,
      (ref) => unmapped.push(ref),
      positionByVerse
    );
    words.push(...r.words);
    variants.push(...r.variants);
    verseRefs.push(...r.verseRefs);
  }

  return { words, variants, verseRefs, unmapped };
}

// --- VerseMap (Hebrew -> canonical) ------------------------------------------------------

/**
 * Parses morphhb's own `VerseMap.xml`: where WLC verse numbering disagrees with the KJV's.
 *
 * ARCHITECTURE.md §0.1 nominates STEPBible's TVTMS as the versification source, and for a
 * general-purpose map across traditions it still is. For *this* text it is the wrong choice:
 * VerseMap.xml is produced by the same editors as the WLC files themselves, describes exactly
 * the text being ingested, and is 107KB against TVTMS's 97MB. Using a third party's general
 * table to map a text whose own publisher ships a specific one is how a mapping drifts from
 * the text it maps. TVTMS remains the right source for the LXX and Vulgate when those arrive.
 *
 * The map is by *exception*: it lists only the ~1,978 verses that diverge. Every WLC verse
 * not named here is identity-mapped, and the ingest gate proves that assumption rather than
 * trusting it.
 */
export async function parseVerseMap(filePath: string, scheme: string): Promise<VersificationRow[]> {
  const xml = await readFile(filePath, "utf8");
  const rows: VersificationRow[] = [];

  const re = /<verse\s+wlc="([^"]+)"\s+kjv="([^"]+)"\s+type="([^"]+)"\s*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const [, wlcRef, kjvRef, type] = m;
    const parsed = parseOsisWithPart(wlcRef);
    if (!parsed) {
      throw new Error(`VerseMap: could not parse wlc ref "${wlcRef}"`);
    }
    rows.push({
      scheme,
      // verseId is filled in by the caller, which alone knows the canonical address space.
      verseId: -1,
      sourceBook: parsed.book,
      sourceChapter: parsed.chapter,
      sourceVerse: parsed.verse,
      sourcePart: parsed.part,
      mappingType: type,
      note: `${wlcRef} = ${kjvRef}`,
    });
    // Stash the canonical side on the row for the caller to resolve.
    (rows[rows.length - 1] as VersificationRow & { kjvRef: string }).kjvRef = kjvRef;
  }

  if (rows.length === 0) {
    throw new Error(`VerseMap: parsed zero mapping rows from ${filePath}`);
  }
  return rows;
}

/** `Ps.13.6!a` -> { book: 'Ps', chapter: 13, verse: 6, part: 'a' }. */
export function parseOsisWithPart(
  ref: string
): { book: string; chapter: number; verse: number; part: string | null } | null {
  const m = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:!([a-z]))?$/.exec(ref);
  if (!m) return null;
  return { book: m[1], chapter: Number(m[2]), verse: Number(m[3]), part: m[4] ?? null };
}

// --- MorphGNT SBLGNT (Greek) --------------------------------------------------------------

const SBLGNT_BOOKS_EXPECTED = 27;

/**
 * The SBLGNT does not use the canonical (`org`) verse division either.
 *
 * It follows the modern critical editions (NA28/UBS5), which differ from the KJV-derived `org`
 * scheme in exactly two places in the whole New Testament. Both are well known and both are
 * verse-division decisions rather than textual disagreements — the same Greek words, cut into
 * verses differently:
 *
 *   - **3 John 15.** `org` runs 3 John to 14 verses; the critical editions split the closing
 *     greetings so the letter ends at verse 15. The text of critical 15 is the second half of
 *     `org` 14.
 *   - **Revelation 12:18.** The critical editions number "and he stood on the sand of the sea"
 *     as 12:18; `org` carries it as the opening clause of 13:1.
 *
 * These are `partial` mappings: the source verse corresponds to *part* of the canonical verse,
 * not all of it, and that distinction is recorded rather than flattened.
 *
 * Hand-written rather than sourced from a mapping file, because MorphGNT ships none — unlike
 * morphhb, which supplies its own VerseMap.xml. ARCHITECTURE.md §0.1 warns against hand-rolling
 * versification and it is right to; the mitigation here is that this is two rows covering two
 * textbook cases, both stated explicitly with what they mean, and both verified against the
 * corpus by the ingest gate (which fails on any SBLGNT reference that resolves to nothing). If
 * a third exception ever appears, that is the signal to stop hand-maintaining this and parse
 * STEPBible's TVTMS properly.
 */
export const GREEK_SCHEME = "greek";

export const SBLGNT_VERSIFICATION_EXCEPTIONS: {
  sourceBook: string;
  sourceChapter: number;
  sourceVerse: number;
  /** Canonical (`org`) reference this source verse belongs to. */
  canonicalRef: string;
  note: string;
}[] = [
  {
    sourceBook: "3John",
    sourceChapter: 1,
    sourceVerse: 15,
    canonicalRef: "3John.1.14",
    note: "Critical editions end 3 John at v15; org merges the closing greetings into v14.",
  },
  {
    sourceBook: "Rev",
    sourceChapter: 12,
    sourceVerse: 18,
    canonicalRef: "Rev.13.1",
    note: "Critical editions number 'and he stood on the sand of the sea' as 12:18; org carries it as the opening clause of 13:1.",
  },
];

/**
 * Parses the MorphGNT SBLGNT: one word per line, seven space-separated fields.
 *
 * ```
 * 010101 N- ----NSF- Βίβλος Βίβλος βίβλος βίβλος
 * │      │  │        │      │      │      └ lemma
 * │      │  │        │      │      └ normalized (accents regularised)
 * │      │  │        │      └ word without surrounding punctuation
 * │      │  │        └ text as printed, punctuation included
 * │      │  └ parsing code
 * │      └ part of speech
 * └ BBCCVV, book 01 = Matthew
 * ```
 *
 * `morph` stores POS and parse joined by a single space — both codes, verbatim, in the order
 * the source presents them. They are fixed-width, so the join is reversible; collapsing them
 * into one column keeps the table shape identical to the Hebrew's, where the source already
 * ships a single combined code.
 */
export async function parseSblgnt(
  dir: string,
  textId: number,
  resolveVerse: (bookId: number, chapter: number, verse: number) => number | null
): Promise<{ words: OriginalWordRow[]; unmapped: string[] }> {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(dir)).filter((f) => f.endsWith("-morphgnt.txt")).sort();

  if (files.length !== SBLGNT_BOOKS_EXPECTED) {
    throw new Error(
      `SBLGNT: expected ${SBLGNT_BOOKS_EXPECTED} book files, found ${files.length}. ` +
        `The source layout changed; check the parser before trusting the corpus.`
    );
  }

  const words: OriginalWordRow[] = [];
  const unmapped: string[] = [];
  // Same per-canonical-verse numbering as the Hebrew. The Greek NT and our canon agree on
  // versification, so no merges are expected here — but numbering it the same way means the
  // two texts obey one rule rather than two, and if a future source disagrees it degrades to
  // a continued sequence rather than a primary-key collision.
  const positionByVerse = new Map<number, number>();

  for (const f of files) {
    const content = await readFile(path.join(dir, f), "utf8");

    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (line === "") continue;

      const fields = line.split(" ").filter((s) => s !== "");
      if (fields.length !== 7) {
        throw new Error(`SBLGNT ${f}: expected 7 fields, got ${fields.length} in: ${line}`);
      }
      const [ref, pos, parse, printed, , normalized, lemma] = fields;

      if (!/^\d{6}$/.test(ref)) {
        throw new Error(`SBLGNT ${f}: malformed reference "${ref}"`);
      }
      // Book 01 is Matthew, which is book_id 40 in our canon.
      const bookId = Number(ref.slice(0, 2)) + 39;
      const chapter = Number(ref.slice(2, 4));
      const verse = Number(ref.slice(4, 6));

      const verseId = resolveVerse(bookId, chapter, verse);
      if (verseId === null) {
        unmapped.push(`${bookId}.${chapter}.${verse}`);
        continue;
      }

      const position = (positionByVerse.get(verseId) ?? 0) + 1;
      positionByVerse.set(verseId, position);
      words.push({
        textId,
        verseId,
        // MorphGNT's own reference, decoded from its BBCCVV field into an OSIS-shaped ref.
        sourceRef: `${bookId}.${chapter}.${verse}`,
        position,
        surface: printed,
        normalized,
        // From `normalized`, not `printed`: MorphGNT's normalized field has already had
        // surrounding punctuation and crasis marks regularised away, so folding it yields the
        // bare word. Folding `printed` would carry a trailing comma into the index.
        searchForm: searchForm(normalized),
        lemma,
        strongs: null, // MorphGNT carries no Strong's numbers; the lemma is the concordance key.
        morph: `${pos} ${parse}`,
        language: "grc",
      });
    }
  }

  return { words, unmapped };
}
