// The Hebrew/Aramaic lexicon: OpenScriptures HebrewLexicon.
//
// WHY THIS EXISTS. `original_words.lemma` for the WLC is not a dictionary headword. The OSIS
// `lemma` attribute is a Strong's *number* with its prefixed morphemes and a space before the
// homonym letter — `b/2617 a`, `c/d/776`. That is exactly the right thing to store (it is what
// the source says, and the morpheme segmentation is information), but it is meaningless to a
// reader. The interlinear and the word index were displaying it. The headword has to come from
// somewhere else, and this is that somewhere.
//
// THE HOMONYM PROBLEM, ESTABLISHED EMPIRICALLY BEFORE ANY OF THIS WAS WRITTEN.
// The two files disagree about what a Strong's number identifies, and they disagree in opposite
// directions, so neither alone is sufficient:
//
//   - `HebrewStrong.xml` has 8,674 entries and ZERO homonym letters. Its own readme says the
//     layout "has duplicated entries recombined". It knows only `H2617`, whose gloss lumps
//     together *kindness* and *reproof* — because Strong's genuinely lumped them.
//   - `LexicalIndex.xml` has 10,221 entries carrying `<xref strong="2617" aug="a"/>`, i.e. the
//     OSHB's augmented numbering, which is what the WLC morphology actually cites. It splits
//     ḥesed "goodness" (H2617a, BDB h.ed.ab) from ḥesed "shame" (H2617b, BDB h.ee.ab). These
//     are different words that share a number.
//
// And the corpus needs both directions: it cites `H2617a`, which HebrewStrong does not have,
// AND it cites plain `H7451`, for which LexicalIndex has only `7451a/b/c`. Measured against the
// live corpus, LexicalIndex alone resolves 99.91% of distinct Strong's keys and HebrewStrong
// alone 87.58%; the union, matched exactly, resolves 100.0000% of the 443k tokens. That
// measurement is what the ingest gate re-derives on every build.
//
// KEYING. `entry_key` is `H` + number + optional homonym letter, and it is deliberately NOT the
// literal string in `original_words.strongs`. Strong's Hebrew dictionary is ONE numbering
// sequence covering Hebrew and Aramaic alike (entry `H2` is Aramaic *ab*); the `A` prefix on a
// word row is a per-word tag derived from that word's morphology code, not part of the
// dictionary's identity. The corpus proves the distinction is per-word and not per-number: seven
// numbers appear under BOTH prefixes (`H3605` occurs 5,412 times Hebrew and once Aramaic).
// Keying the lexicon on the word-level tag would therefore duplicate entries on the strength of
// a tagging accident. The entry carries its own `language`; lookups normalise `A` -> `H`.
//
// WHAT IS NOT HERE. LexicalIndex entries with no `<xref strong=...>` are BDB-only headwords with
// no Strong's number; they are skipped, because this table exists to resolve
// `original_words.strongs` and a row no key can reach is dead weight. BrownDriverBriggs.xml is
// likewise not ingested: it is 2.9MB of nested, still-incomplete article markup whose value is
// the full article, not a field, and the lexical index already hands us BDB's *sense
// distinction* (the `bdb` xref id) — which is the part that resolves homonyms. If full BDB
// articles are wanted later they are a separate table, not a column here.

import { createReadStream } from "node:fs";
import sax from "sax";

/**
 * The licence, taken from the repository's own readme rather than assumed.
 *
 * The task that commissioned this called HebrewLexicon public domain. It is not. The readme is
 * explicit and the distinction is real: the *files* are CC BY 4.0, and only the underlying
 * nineteenth-century text of Brown-Driver-Briggs and Strong's has fallen into the public domain.
 * We redistribute the files, so CC BY 4.0 is the licence that binds us, and it carries an
 * attribution condition the readme names the beneficiary of.
 */
export const HEBREW_LEXICON_LICENSE = "CC BY 4.0";
export const HEBREW_LEXICON_ATTRIBUTION =
  "OpenScriptures HebrewLexicon: Strong's Hebrew Dictionary and the OSHB Lexical Index " +
  "(with Brown-Driver-Briggs sense references and TWOT numbers for reference only). " +
  "Credit the Open Scriptures Hebrew Bible Project. Licensed CC BY 4.0; the underlying text of " +
  "Brown, Driver, Briggs and Strong's Hebrew dictionary is itself public domain.";
export const HEBREW_LEXICON_SOURCE_URL = "https://github.com/openscriptures/HebrewLexicon";

export interface LexiconEntryRow {
  /** `H2617` or `H2617a`. Never `A…` — see the keying note above. */
  entryKey: string;
  strongsNum: number;
  /** The OSHB homonym letter, or null for the undifferentiated Strong's entry. */
  homonym: string | null;
  /** ISO 639-3: 'hbo' Hebrew, 'arc' Aramaic. */
  language: string;
  /** Pointed Hebrew/Aramaic dictionary headword. The thing the reader actually wanted. */
  headword: string;
  xlit: string;
  /** Part-of-speech code, verbatim from whichever source supplied it. Vocabularies differ. */
  pos: string;
  /** Strong's pronunciation respelling (`kheh'-sed`). Empty when only the index knows the word. */
  pron: string;
  /** One- or two-word gloss. */
  gloss: string;
  /** Strong's fuller definition, tags flattened. */
  meaning: string;
  /** Strong's list of KJV renderings. */
  usage: string;
  /** Strong's etymology note (`from 2616;`). */
  etymology: string;
  /** TWOT number. Reference only — the OSHB readme is emphatic that TWOT is not transcribed. */
  twot: string;
  /** Brown-Driver-Briggs article id. This is what distinguishes the homonyms. */
  bdb: string;
  /** 'strong' | 'oshb' | 'strong+oshb' — which file(s) this row was assembled from. */
  provenance: string;
}

// --- HebrewStrong.xml ------------------------------------------------------------------

interface StrongEntry {
  num: number;
  homonym: string | null;
  lang: string;
  headword: string;
  xlit: string;
  pos: string;
  pron: string;
  gloss: string;
  meaning: string;
  usage: string;
  etymology: string;
}

/**
 * SAX rather than a regex over `<entry>` blocks.
 *
 * `<meaning>` carries inline markup — `<def>father</def>, in a literal and immediate…` — and the
 * first `<def>` inside it is the short gloss while the whole element is the full definition. A
 * parser has to be able to say "the text of this element including descendants" and "the text of
 * that child specifically" at the same time, and tag-stripping regexes are how the two get
 * confused. It also lets the headword `<w>` be told apart from the `<w src="H2616">2616</w>`
 * cross-reference links that appear *inside* `<source>` and `<meaning>` — which a naive
 * "first `<w>` in the entry" rule gets right only until an entry has no headword.
 */
export async function parseHebrewStrong(filePath: string): Promise<StrongEntry[]> {
  const entries: StrongEntry[] = [];

  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: false, normalize: false });

    let current: StrongEntry | null = null;
    /** Element names open inside the current <entry>, innermost last. */
    const stack: string[] = [];
    /** Accumulating text for prose elements, keyed by element name. */
    let buffer: { name: string; text: string } | null = null;
    let sawHeadword = false;
    let firstDef: string | null = null;
    let defText: string | null = null;

    parser.on("error", (err) => reject(err));

    parser.on("opentag", (node) => {
      const name = node.name.replace(/^.*:/, "");
      const attr = node.attributes as Record<string, string>;

      if (name === "entry") {
        const m = /^H(\d+)([a-z])?$/.exec(attr.id ?? "");
        if (!m) {
          // Not a silent skip. An id shape we do not understand means the file changed, and a
          // lexicon quietly missing entries is precisely the failure this whole table exists
          // to prevent downstream.
          reject(new Error(`HebrewStrong: unrecognised entry id "${attr.id}". Source layout changed.`));
          return;
        }
        current = {
          num: Number(m[1]),
          homonym: m[2] ?? null,
          lang: "hbo",
          headword: "",
          xlit: "",
          pos: "",
          pron: "",
          gloss: "",
          meaning: "",
          usage: "",
          etymology: "",
        };
        stack.length = 0;
        sawHeadword = false;
        firstDef = null;
        defText = null;
        return;
      }
      if (!current) return;

      // The headword <w> is the one that is a DIRECT child of <entry>. A <w> nested inside
      // <source>/<meaning> is a cross-reference to another entry and must not overwrite it.
      if (name === "w" && stack.length === 0 && !sawHeadword) {
        sawHeadword = true;
        current.pos = attr.pos ?? "";
        current.pron = attr.pron ?? "";
        current.xlit = attr.xlit ?? "";
        // 'heb' | 'arc' | 'x-pn'. `x-pn` is Strong's marker for a proper noun — not a language.
        // The part of speech already records proper-noun-ness (`n-pr-m`), so it maps to Hebrew
        // and the LexicalIndex language, which is a real heb/arc split, overrides it on merge.
        const xmlLang = attr["xml:lang"] ?? "heb";
        current.lang = xmlLang === "arc" ? "arc" : "hbo";
        buffer = { name: "w", text: "" };
        stack.push(name);
        return;
      }

      if (stack.length === 0 && (name === "source" || name === "meaning" || name === "usage")) {
        buffer = { name, text: "" };
      }
      // `<def>` inside `<meaning>`: capture the FIRST one as the short gloss, while the
      // enclosing buffer keeps accumulating so `meaning` stays whole.
      if (name === "def" && firstDef === null && buffer?.name === "meaning") {
        defText = "";
      }
      stack.push(name);
    });

    parser.on("text", (t) => {
      if (!current) return;
      if (buffer) buffer.text += t;
      if (defText !== null) defText += t;
    });

    parser.on("closetag", (rawName) => {
      const name = rawName.replace(/^.*:/, "");

      if (name === "entry") {
        if (current) entries.push(current);
        current = null;
        buffer = null;
        return;
      }
      if (!current) return;
      stack.pop();

      if (name === "def" && defText !== null && firstDef === null) {
        firstDef = defText.replace(/\s+/g, " ").trim();
        current.gloss = firstDef;
        defText = null;
      }
      if (buffer && buffer.name === name && stack.length === 0) {
        const text = buffer.text.replace(/\s+/g, " ").trim();
        if (name === "w") current.headword = text;
        else if (name === "source") current.etymology = text;
        else if (name === "meaning") current.meaning = text;
        else if (name === "usage") current.usage = text;
        buffer = null;
      }
    });

    parser.on("end", () => resolve(entries));
    createReadStream(filePath, { encoding: "utf8" }).pipe(parser);
  });
}

// --- LexicalIndex.xml ------------------------------------------------------------------

interface IndexEntry {
  id: string;
  num: number;
  homonym: string | null;
  lang: string;
  headword: string;
  xlit: string;
  pos: string;
  gloss: string;
  twot: string;
  bdb: string;
}

/**
 * The OSHB lexical index: the only file that speaks the augmented numbering the WLC cites.
 *
 * Layout is `<part xml:lang="heb">` / `<part xml:lang="arc">` wrapping `<entry id="ecp">` with a
 * headword `<w>`, a `<pos>`, a `<def>` and an `<xref strong="2617" aug="a" bdb="…" twot="…"/>`.
 * The `<part>` is where the Hebrew/Aramaic split is genuinely recorded, which is why it beats
 * Strong's `xml:lang` on merge.
 */
export async function parseLexicalIndex(filePath: string): Promise<IndexEntry[]> {
  const entries: IndexEntry[] = [];

  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: false, normalize: false });

    let partLang = "hbo";
    let current: (IndexEntry & { hasXref: boolean }) | null = null;
    let buffer: { name: string; text: string } | null = null;

    parser.on("error", (err) => reject(err));

    parser.on("opentag", (node) => {
      const name = node.name.replace(/^.*:/, "");
      const attr = node.attributes as Record<string, string>;

      if (name === "part") {
        partLang = attr["xml:lang"] === "arc" ? "arc" : "hbo";
        return;
      }
      if (name === "entry") {
        current = {
          id: attr.id ?? "",
          num: 0,
          homonym: null,
          lang: partLang,
          headword: "",
          xlit: "",
          pos: "",
          gloss: "",
          twot: "",
          bdb: "",
          hasXref: false,
        };
        return;
      }
      if (!current) return;

      if (name === "xref") {
        current.bdb = attr.bdb ?? "";
        current.twot = attr.twot ?? "";
        if (attr.strong !== undefined && /^\d+$/.test(attr.strong)) {
          current.num = Number(attr.strong);
          current.homonym = attr.aug ?? null;
          current.hasXref = true;
        }
        return;
      }
      if (name === "w" && current.headword === "") {
        current.xlit = attr.xlit ?? "";
        buffer = { name: "w", text: "" };
      } else if (name === "pos" || name === "def") {
        buffer = { name, text: "" };
      }
    });

    parser.on("text", (t) => {
      if (buffer) buffer.text += t;
    });

    parser.on("closetag", (rawName) => {
      const name = rawName.replace(/^.*:/, "");

      if (name === "entry") {
        // Entries with no Strong's xref are BDB-only headwords. No key reaches them, so they
        // are not rows. See the header note.
        if (current && current.hasXref) {
          entries.push({
            id: current.id,
            num: current.num,
            homonym: current.homonym,
            lang: current.lang,
            headword: current.headword,
            xlit: current.xlit,
            pos: current.pos,
            gloss: current.gloss,
            twot: current.twot,
            bdb: current.bdb,
          });
        }
        current = null;
        buffer = null;
        return;
      }
      if (!current || !buffer || buffer.name !== name) return;

      const text = buffer.text.replace(/\s+/g, " ").trim();
      if (name === "w") current.headword = text;
      else if (name === "pos") current.pos = text;
      else if (name === "def") current.gloss = text;
      buffer = null;
    });

    parser.on("end", () => resolve(entries));
    createReadStream(filePath, { encoding: "utf8" }).pipe(parser);
  });
}

// --- Merge ------------------------------------------------------------------------------

export interface LexiconBuild {
  rows: LexiconEntryRow[];
  /** Augmented keys the index supplied that Strong's cannot express. Reported, not an error. */
  augmentedCount: number;
  /** (strong, aug) pairs the index gives more than one entry for. Reported; first wins. */
  collisions: string[];
  strongCount: number;
  indexCount: number;
}

/**
 * Assembles one row per Strong's key from both files.
 *
 * The merge rule is asymmetric on purpose, and the asymmetry is the scholarship:
 *
 *   - The INDEX wins headword, transliteration, part of speech, gloss and language, because the
 *     index is the file that distinguishes homonyms. Its gloss for H2617a is "goodness" and for
 *     H2617b "shame"; Strong's has one gloss for both and it is "kindness".
 *   - STRONG'S wins pronunciation, etymology, full meaning and KJV usage, because the index does
 *     not carry them — but ONLY onto its own undifferentiated key. Strong's prose is deliberately
 *     NOT copied down onto `H2617a` and `H2617b`. Doing so would print a definition under a
 *     homonym that its author never distinguished, which is the exact false precision this table
 *     was built to remove. The base row keeps it, and the accessor returns base and homonym
 *     together so the reader sees which is which.
 *
 * A key present in both files (a number with no homonyms, the common case) merges into one row.
 */
export function buildLexicon(strong: StrongEntry[], index: IndexEntry[]): LexiconBuild {
  const byKey = new Map<string, LexiconEntryRow>();

  const key = (num: number, homonym: string | null) => `H${num}${homonym ?? ""}`;

  for (const e of strong) {
    const k = key(e.num, e.homonym);
    byKey.set(k, {
      entryKey: k,
      strongsNum: e.num,
      homonym: e.homonym,
      language: e.lang,
      headword: e.headword,
      xlit: e.xlit,
      pos: e.pos,
      pron: e.pron,
      gloss: e.gloss,
      meaning: e.meaning,
      usage: e.usage,
      etymology: e.etymology,
      twot: "",
      bdb: "",
      provenance: "strong",
    });
  }

  const collisions: string[] = [];
  let augmentedCount = 0;

  // Document order, first wins. The index has exactly one genuine collision (H2004, the
  // independent pronoun הֵנָּה, entered twice as "they" and "themselves"); a deterministic
  // rule plus a report beats a merge that invents a gloss neither entry contains.
  for (const e of index) {
    const k = key(e.num, e.homonym);
    if (e.homonym !== null) augmentedCount += 1;

    const existing = byKey.get(k);
    if (existing && existing.provenance !== "strong") {
      collisions.push(`${k} (${existing.headword} "${existing.gloss}" vs ${e.headword} "${e.gloss}")`);
      continue;
    }
    if (existing) {
      // Merge onto Strong's row: the index overrides the fields it knows better.
      existing.language = e.lang;
      if (e.headword !== "") existing.headword = e.headword;
      if (e.xlit !== "") existing.xlit = e.xlit;
      if (e.pos !== "") existing.pos = e.pos;
      if (e.gloss !== "") existing.gloss = e.gloss;
      existing.twot = e.twot;
      existing.bdb = e.bdb;
      existing.provenance = "strong+oshb";
      continue;
    }
    // Index-only: an augmented key Strong's cannot express. No Strong's prose — see above.
    byKey.set(k, {
      entryKey: k,
      strongsNum: e.num,
      homonym: e.homonym,
      language: e.lang,
      headword: e.headword,
      xlit: e.xlit,
      pos: e.pos,
      pron: "",
      gloss: e.gloss,
      meaning: "",
      usage: "",
      etymology: "",
      twot: e.twot,
      bdb: e.bdb,
      provenance: "oshb",
    });
  }

  const rows = [...byKey.values()].sort(
    (a, b) => a.strongsNum - b.strongsNum || (a.homonym ?? "").localeCompare(b.homonym ?? "")
  );
  return {
    rows,
    augmentedCount,
    collisions,
    strongCount: strong.length,
    indexCount: index.length,
  };
}

/**
 * Normalises a Strong's key onto the lexicon's key space.
 *
 * `A5020` -> `H5020`: the `A` is a per-word morphology tag, not part of the dictionary
 * identity — see the keying note at the top of this file. Returns null for anything that is not
 * a Strong's key at all.
 *
 * `G` is rejected rather than folded in. Strong's Greek is a SEPARATE numbering sequence — G26
 * is *agapē*, H26 is *Abagtha* — and this lexicon contains no Greek. Accepting it would answer a
 * Greek question with a Hebrew entry, which is worse than answering nothing.
 */
export function lexiconKey(raw: string): string | null {
  // Lower-case class, because the subject has already been lower-cased. An upper-case [HA]
  // here matches nothing and the function returns null for every real key — which is exactly
  // what it did, and what the ingest's coverage gate caught at 0.00%.
  const m = /^[ha]?(\d{1,5})([a-z])?$/.exec(raw.trim().toLowerCase());
  if (!m) return null;
  return `H${Number(m[1])}${m[2] ?? ""}`;
}
