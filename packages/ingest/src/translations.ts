// The reviewed translation table.
//
// Every entry here is a claim about somebody else's licence, and that claim is rendered under
// every passage a reader loads. So `copyrightNotice` is not written by us: it is transcribed
// from the distribution's OWN copyright file (`copr.htm`, shipped inside each eBible.org zip),
// and `parseUsfx` returns that file's text and sha256 so the ingest can check the transcription
// against the source on every build rather than trusting a comment written once. A licence
// that silently changes upstream fails the build.
//
// WHAT WAS DELIBERATELY NOT ADDED, AND WHY. See docs and the report accompanying this change:
//
//   * Douay-Rheims 1899 (eBible `engDRA`) — public domain, and the only Catholic/Vulgate-line
//     text on the shortlist, but it numbers the Psalms in the VULGATE tradition. Proven, not
//     assumed: DRA Ps 23:1 is "The earth is the Lord's and the fulness thereof", which is
//     canonical Ps 24:1. Ingesting it as `org` would silently mis-anchor roughly 2,400 psalm
//     verses onto their neighbours — every annotation, cross-reference and interlinear tie on
//     them wrong, with the text still rendering perfectly. It needs a vul -> canonical map,
//     which has to be COMPOSED (the open mapping data maps vul -> Hebrew-numbered `org` and
//     eng -> Hebrew-numbered `org`, and this corpus's canonical scheme is the eng/KJV one, so
//     the second has to be inverted) and then verified verse by verse. That is a separate
//     piece of work with its own gate, not a line in this table.
//   * The full Brenton LXX and the Clementine Vulgate (`latVUC`) remain withheld: their source
//     systems contain many chapter/verse divergences and deuterocanonical books that this
//     66-book canon has no addresses for. A nine-book Brenton selection below is loaded only where
//     an identity map, or a reviewed offset table, has been independently verified; it must not be expanded by assumption.
//
// A wrong versification map is worse than an absent translation, because absence is visible
// and a wrong map is not.

export interface VerseOffset {
  bookId: number;
  chapter: number;
  fromVerse: number;
  toVerse: number;
  canonicalChapter: number;
  canonicalFirstVerse: number;
}

export function mapSourceVerse(
  t: Pick<TranslationSource, "verseOffsets">,
  bookId: number,
  chapter: number,
  verse: number,
): { chapter: number; verse: number } {
  const o = t.verseOffsets?.find(
    (e) => e.bookId === bookId && e.chapter === chapter && verse >= e.fromVerse && verse <= e.toVerse,
  );
  return o ? { chapter: o.canonicalChapter, verse: o.canonicalFirstVerse + verse - o.fromVerse } : { chapter, verse };
}

export function isUnplacedSourceVerse(
  t: Pick<TranslationSource, "unplacedSourceVerses">,
  bookId: number,
  chapter: number,
  verse: number,
): boolean {
  return t.unplacedSourceVerses?.some((u) => u.bookId === bookId && u.chapter === chapter && u.verse === verse) ?? false;
}

export interface TranslationSource {
  /** Fixed. Ends up in verse_texts, verse_omissions and user annotations — never renumber. */
  translationId: number;
  code: string;
  name: string;
  language: string;
  /** eBible.org translation id; also the zip basename. */
  ebibleId: string;
  license: string;
  /** Transcribed from the distribution's copr.htm. Rendered under every passage. */
  copyrightNotice: string;
  /**
   * A phrase that MUST appear in the distribution's own copr.htm. The build fails if it does
   * not, so an upstream licence change cannot pass unnoticed — which is the whole reason the
   * parser returns the file rather than us pasting from it once and forgetting.
   */
  licenseAssertion: string;
  /** 'all' = protocanon complete; 'OT'/'NT' = this text covers only that testament. */
  scope: "all" | "OT" | "NT";
  /** Plain-English, reader-facing. Empty for a full Bible. */
  scopeNote: string;
  /** Expected count of printed verses, as a band. Measured before this shipped. */
  expectedVerses: readonly [number, number];
  /** `org` for canonical numbering; divergent editions must supply rows in versification_map. */
  versification?: string;
  /** Some historical editions omit a protocanonical book or use a separate source book. */
  includedBookIds?: readonly number[];
  /**
   * Reviewed exceptions to identity for a divergent edition: each run of source verses maps to
   * consecutive canonical verses. Any source verse not covered maps to its own label.
   */
  verseOffsets?: readonly VerseOffset[];
  /**
   * Reviewed source verses with no one-to-one canonical counterpart. Not stored and counted in
   * the build log; any other source verse without an address still fails the build.
   */
  unplacedSourceVerses?: readonly { bookId: number; chapter: number; verse: number }[];
  /** Exact count of `versification` omission rows the reviewed map produces. Gated in ingest. */
  versificationOmissions?: number;
  /**
   * Source-specific text repair, applied before the shared normalization.
   *
   * Only one text needs it and the reason is specific, so it is a per-source field rather
   * than another rule in normalize-text.ts, which exists for a defect in the WEB
   * distribution and should not accumulate unrelated ones.
   */
  quirks?: {
    pattern: RegExp;
    replacement: string;
    /** How many replacements to expect, as a band. A silent change in either direction fails. */
    expected: readonly [number, number];
    why: string;
  };
}

export const TRANSLATION_SOURCES: readonly TranslationSource[] = [
  {
    translationId: 8,
    code: "LXX",
    name: "Brenton's Septuagint (selected Old Testament books)",
    language: "English",
    ebibleId: "eng-Brenton",
    license: "Public Domain",
    copyrightNotice:
      "Brenton Septuagint Translation. Translation of the Greek Septuagint into English by Sir " +
      "Lancelot Charles Lee Brenton. Published in 1851, and now in the Public Domain.",
    licenseAssertion: "Published in 1851, and now in the Public Domain",
    scope: "OT",
    scopeNote:
      "This is a selection from Brenton's public-domain English translation of the Septuagint: " +
      "Genesis, Exodus, Leviticus, Numbers, Deuteronomy, Nehemiah, Lamentations, Habakkuk, and " +
      "Haggai. The five books of the Pentateuch are included under a reviewed verse map, because " +
      "the Septuagint numbers some passages differently and, in Exodus 36-39, orders the account " +
      "of the tabernacle differently. Sixteen Brenton verses in Exodus, Leviticus and Numbers have " +
      "no single Hebrew-numbered counterpart and are not shown. The remaining books are withheld " +
      "until their differing Greek verse systems have a separately reviewed mapping.",
    expectedVerses: [6_300, 6_500],
    versification: "brenton",
    // Brenton's distribution uses a genuinely different LXX verse system across many books.
    // Nehemiah, Lamentations, Habakkuk and Haggai are identity; the Pentateuch is identity except
    // the runs in `verseOffsets`, each checked against KJV wording (Jaccard on content words,
    // scripts/check-brenton-identity.ts plus a pair-by-pair probe, 2026-10-08; see the execution
    // notes for chunk 9 in docs/plans/2026-10-08-follow-the-evidence.md). Source labels with no
    // counterpart (Gen 31:51, 35:21; Exod 25:6, 28:23-28 ...) become versification omissions.
    // `unplacedSourceVerses` are Brenton verses with no one-to-one Hebrew counterpart: split
    // remnants of a re-divided verse, or Exodus 36-39 material the wording check could not match.
    // Excluding the rest is visible in translation_books and safer than putting a beautiful but
    // wrong verse beside the Hebrew.
    includedBookIds: [1, 2, 3, 4, 5, 16, 25, 35, 37],
    // Gen 2, Exod 63, Lev 1, Num 2, Deut 1, Nehemiah and Lamentations 21.
    versificationOmissions: 90,
    verseOffsets: [
      // Genesis: Brenton opens chapter 32 with Hebrew 31:55.
      { bookId: 1, chapter: 32, fromVerse: 1, toVerse: 1, canonicalChapter: 31, canonicalFirstVerse: 55 },
      { bookId: 1, chapter: 32, fromVerse: 2, toVerse: 33, canonicalChapter: 32, canonicalFirstVerse: 1 },
      // Exodus: 7:26-29 is Hebrew 8:1-4; 20:13-15 orders adultery, theft, murder; 21:16-17 swap;
      // 21:37 is Hebrew 22:1; chapters 36-39 follow the Septuagint order of the tabernacle account.
      { bookId: 2, chapter: 7, fromVerse: 26, toVerse: 29, canonicalChapter: 8, canonicalFirstVerse: 1 },
      { bookId: 2, chapter: 8, fromVerse: 1, toVerse: 28, canonicalChapter: 8, canonicalFirstVerse: 5 },
      { bookId: 2, chapter: 20, fromVerse: 13, toVerse: 14, canonicalChapter: 20, canonicalFirstVerse: 14 },
      { bookId: 2, chapter: 20, fromVerse: 15, toVerse: 15, canonicalChapter: 20, canonicalFirstVerse: 13 },
      { bookId: 2, chapter: 21, fromVerse: 16, toVerse: 16, canonicalChapter: 21, canonicalFirstVerse: 17 },
      { bookId: 2, chapter: 21, fromVerse: 17, toVerse: 17, canonicalChapter: 21, canonicalFirstVerse: 16 },
      { bookId: 2, chapter: 21, fromVerse: 37, toVerse: 37, canonicalChapter: 22, canonicalFirstVerse: 1 },
      { bookId: 2, chapter: 22, fromVerse: 1, toVerse: 30, canonicalChapter: 22, canonicalFirstVerse: 2 },
      { bookId: 2, chapter: 36, fromVerse: 9, toVerse: 10, canonicalChapter: 39, canonicalFirstVerse: 2 },
      { bookId: 2, chapter: 36, fromVerse: 12, toVerse: 23, canonicalChapter: 39, canonicalFirstVerse: 5 },
      { bookId: 2, chapter: 36, fromVerse: 26, toVerse: 38, canonicalChapter: 39, canonicalFirstVerse: 19 },
      { bookId: 2, chapter: 37, fromVerse: 1, toVerse: 2, canonicalChapter: 36, canonicalFirstVerse: 8 },
      { bookId: 2, chapter: 37, fromVerse: 3, toVerse: 6, canonicalChapter: 36, canonicalFirstVerse: 35 },
      { bookId: 2, chapter: 37, fromVerse: 7, toVerse: 21, canonicalChapter: 38, canonicalFirstVerse: 9 },
      { bookId: 2, chapter: 38, fromVerse: 1, toVerse: 3, canonicalChapter: 37, canonicalFirstVerse: 1 },
      { bookId: 2, chapter: 38, fromVerse: 4, toVerse: 8, canonicalChapter: 37, canonicalFirstVerse: 5 },
      { bookId: 2, chapter: 38, fromVerse: 9, toVerse: 9, canonicalChapter: 37, canonicalFirstVerse: 10 },
      { bookId: 2, chapter: 38, fromVerse: 10, toVerse: 10, canonicalChapter: 37, canonicalFirstVerse: 13 },
      { bookId: 2, chapter: 38, fromVerse: 11, toVerse: 14, canonicalChapter: 37, canonicalFirstVerse: 15 },
      { bookId: 2, chapter: 38, fromVerse: 15, toVerse: 15, canonicalChapter: 37, canonicalFirstVerse: 19 },
      { bookId: 2, chapter: 38, fromVerse: 17, toVerse: 17, canonicalChapter: 37, canonicalFirstVerse: 23 },
      { bookId: 2, chapter: 38, fromVerse: 18, toVerse: 18, canonicalChapter: 36, canonicalFirstVerse: 34 },
      { bookId: 2, chapter: 38, fromVerse: 23, toVerse: 23, canonicalChapter: 38, canonicalFirstVerse: 3 },
      { bookId: 2, chapter: 38, fromVerse: 24, toVerse: 24, canonicalChapter: 38, canonicalFirstVerse: 4 },
      { bookId: 2, chapter: 38, fromVerse: 25, toVerse: 25, canonicalChapter: 37, canonicalFirstVerse: 29 },
      { bookId: 2, chapter: 38, fromVerse: 26, toVerse: 26, canonicalChapter: 38, canonicalFirstVerse: 8 },
      { bookId: 2, chapter: 38, fromVerse: 27, toVerse: 27, canonicalChapter: 40, canonicalFirstVerse: 31 },
      { bookId: 2, chapter: 39, fromVerse: 1, toVerse: 4, canonicalChapter: 38, canonicalFirstVerse: 24 },
      { bookId: 2, chapter: 39, fromVerse: 6, toVerse: 7, canonicalChapter: 38, canonicalFirstVerse: 28 },
      { bookId: 2, chapter: 39, fromVerse: 8, toVerse: 8, canonicalChapter: 38, canonicalFirstVerse: 30 },
      { bookId: 2, chapter: 39, fromVerse: 9, toVerse: 9, canonicalChapter: 38, canonicalFirstVerse: 31 },
      { bookId: 2, chapter: 39, fromVerse: 11, toVerse: 11, canonicalChapter: 39, canonicalFirstVerse: 32 },
      { bookId: 2, chapter: 39, fromVerse: 13, toVerse: 13, canonicalChapter: 39, canonicalFirstVerse: 1 },
      { bookId: 2, chapter: 39, fromVerse: 14, toVerse: 14, canonicalChapter: 39, canonicalFirstVerse: 33 },
      { bookId: 2, chapter: 39, fromVerse: 16, toVerse: 16, canonicalChapter: 39, canonicalFirstVerse: 38 },
      { bookId: 2, chapter: 39, fromVerse: 17, toVerse: 17, canonicalChapter: 39, canonicalFirstVerse: 37 },
      { bookId: 2, chapter: 39, fromVerse: 18, toVerse: 18, canonicalChapter: 39, canonicalFirstVerse: 36 },
      { bookId: 2, chapter: 39, fromVerse: 19, toVerse: 19, canonicalChapter: 39, canonicalFirstVerse: 41 },
      { bookId: 2, chapter: 39, fromVerse: 20, toVerse: 20, canonicalChapter: 39, canonicalFirstVerse: 40 },
      { bookId: 2, chapter: 39, fromVerse: 21, toVerse: 21, canonicalChapter: 39, canonicalFirstVerse: 34 },
      { bookId: 2, chapter: 39, fromVerse: 22, toVerse: 23, canonicalChapter: 39, canonicalFirstVerse: 42 },
      // Leviticus: 5:20-26 is Hebrew 6:1-7; Brenton 8:18 holds Hebrew 8:18-19.
      { bookId: 3, chapter: 5, fromVerse: 20, toVerse: 26, canonicalChapter: 6, canonicalFirstVerse: 1 },
      { bookId: 3, chapter: 6, fromVerse: 1, toVerse: 23, canonicalChapter: 6, canonicalFirstVerse: 8 },
      { bookId: 3, chapter: 8, fromVerse: 19, toVerse: 29, canonicalChapter: 8, canonicalFirstVerse: 20 },
      // Numbers: census order in 1 and 26; 10:34-36 rotate; 16:36-50 is Brenton 17:1-15;
      // 21:19 and 27:3 hold two Hebrew verses each; 29:40 is Brenton 30:1.
      { bookId: 4, chapter: 1, fromVerse: 24, toVerse: 35, canonicalChapter: 1, canonicalFirstVerse: 26 },
      { bookId: 4, chapter: 1, fromVerse: 36, toVerse: 37, canonicalChapter: 1, canonicalFirstVerse: 24 },
      { bookId: 4, chapter: 10, fromVerse: 34, toVerse: 35, canonicalChapter: 10, canonicalFirstVerse: 35 },
      { bookId: 4, chapter: 10, fromVerse: 36, toVerse: 36, canonicalChapter: 10, canonicalFirstVerse: 34 },
      { bookId: 4, chapter: 17, fromVerse: 1, toVerse: 15, canonicalChapter: 16, canonicalFirstVerse: 36 },
      { bookId: 4, chapter: 17, fromVerse: 16, toVerse: 28, canonicalChapter: 17, canonicalFirstVerse: 1 },
      { bookId: 4, chapter: 21, fromVerse: 20, toVerse: 20, canonicalChapter: 21, canonicalFirstVerse: 21 },
      { bookId: 4, chapter: 26, fromVerse: 15, toVerse: 18, canonicalChapter: 26, canonicalFirstVerse: 19 },
      { bookId: 4, chapter: 26, fromVerse: 19, toVerse: 21, canonicalChapter: 26, canonicalFirstVerse: 23 },
      { bookId: 4, chapter: 26, fromVerse: 22, toVerse: 23, canonicalChapter: 26, canonicalFirstVerse: 26 },
      { bookId: 4, chapter: 26, fromVerse: 24, toVerse: 27, canonicalChapter: 26, canonicalFirstVerse: 15 },
      { bookId: 4, chapter: 26, fromVerse: 28, toVerse: 31, canonicalChapter: 26, canonicalFirstVerse: 44 },
      { bookId: 4, chapter: 26, fromVerse: 32, toVerse: 38, canonicalChapter: 26, canonicalFirstVerse: 28 },
      { bookId: 4, chapter: 26, fromVerse: 39, toVerse: 41, canonicalChapter: 26, canonicalFirstVerse: 35 },
      { bookId: 4, chapter: 26, fromVerse: 42, toVerse: 45, canonicalChapter: 26, canonicalFirstVerse: 38 },
      { bookId: 4, chapter: 26, fromVerse: 46, toVerse: 47, canonicalChapter: 26, canonicalFirstVerse: 42 },
      { bookId: 4, chapter: 27, fromVerse: 4, toVerse: 6, canonicalChapter: 27, canonicalFirstVerse: 5 },
      { bookId: 4, chapter: 30, fromVerse: 1, toVerse: 1, canonicalChapter: 29, canonicalFirstVerse: 40 },
      { bookId: 4, chapter: 30, fromVerse: 2, toVerse: 17, canonicalChapter: 30, canonicalFirstVerse: 1 },
      // Deuteronomy: Hebrew 12:32 and 22:30 open Brenton 13 and 23; the corn-field law (23:25)
      // precedes the vineyard law (Hebrew 23:24); 14:14 has no Brenton label.
      { bookId: 5, chapter: 13, fromVerse: 1, toVerse: 1, canonicalChapter: 12, canonicalFirstVerse: 32 },
      { bookId: 5, chapter: 13, fromVerse: 2, toVerse: 19, canonicalChapter: 13, canonicalFirstVerse: 1 },
      { bookId: 5, chapter: 23, fromVerse: 1, toVerse: 1, canonicalChapter: 22, canonicalFirstVerse: 30 },
      { bookId: 5, chapter: 23, fromVerse: 2, toVerse: 24, canonicalChapter: 23, canonicalFirstVerse: 1 },
      { bookId: 5, chapter: 23, fromVerse: 26, toVerse: 26, canonicalChapter: 23, canonicalFirstVerse: 24 },
    ],
    unplacedSourceVerses: [
      { bookId: 2, chapter: 36, verse: 8 },
      { bookId: 2, chapter: 36, verse: 11 },
      { bookId: 2, chapter: 36, verse: 24 },
      { bookId: 2, chapter: 36, verse: 25 },
      { bookId: 2, chapter: 38, verse: 16 },
      { bookId: 2, chapter: 38, verse: 19 },
      { bookId: 2, chapter: 38, verse: 20 },
      { bookId: 2, chapter: 38, verse: 21 },
      { bookId: 2, chapter: 38, verse: 22 },
      { bookId: 2, chapter: 39, verse: 5 },
      { bookId: 2, chapter: 39, verse: 10 },
      { bookId: 2, chapter: 39, verse: 12 },
      { bookId: 2, chapter: 39, verse: 15 },
      { bookId: 3, chapter: 8, verse: 30 },
      { bookId: 4, chapter: 21, verse: 21 },
      { bookId: 4, chapter: 27, verse: 7 },
    ],
  },
  {
    translationId: 3,
    code: "KJV",
    name: "King James Version",
    language: "English",
    ebibleId: "eng-kjv2006",
    license: "Public Domain (see notice: UK Crown letters patent)",
    // Transcribed verbatim from eng-kjv2006/copr.htm. The letters-patent paragraph is kept in
    // full and NOT summarised: it is the single sentence in this whole table that states a
    // live restriction, it applies to printing in one country only, and paraphrasing a legal
    // notice into "public domain" is exactly the shortcut a licensor audits for.
    copyrightNotice:
      "The King James Version or Authorized Version of the Holy Bible, using the standardized " +
      "text of 1769. Public Domain. Letters patent issued by King James with no expiration date " +
      "means that to print this translation in the United Kingdom or import printed copies into " +
      "the UK, you need permission. Currently, the Cambridge University Press, the Oxford " +
      "University Press, and Collins have the exclusive right to print this Bible translation in " +
      "the UK. This royal decree has no effect outside of the UK, where this work is firmly in " +
      "the Public Domain. This free text of the King James Version of the Holy Bible is brought " +
      "to you courtesy of the Crosswire Bible Society and eBible.org.",
    licenseAssertion: "Letters patent issued by King James",
    scope: "all",
    scopeNote: "",
    expectedVerses: [31_050, 31_150],
  },
  {
    translationId: 4,
    code: "ASV",
    name: "American Standard Version (1901)",
    language: "English",
    ebibleId: "eng-asv",
    license: "Public Domain",
    copyrightNotice:
      "The American Standard Version of the Holy Bible, first published in 1901, is in the " +
      "Public Domain. Copy freely. This public domain Bible translation is brought to you " +
      "courtesy of eBible.org.",
    licenseAssertion: "American Standard Version of the Holy Bible is in the Public Domain",
    scope: "all",
    scopeNote: "",
    expectedVerses: [31_020, 31_120],
  },
  {
    translationId: 5,
    code: "DBY",
    name: "Darby Translation",
    language: "English",
    ebibleId: "engDBY",
    license: "Public Domain",
    copyrightNotice:
      "The Holy Scriptures, a New Translation from the Original Languages by J. N. Darby. " +
      "Public Domain. Courtesy of eBible.org.",
    licenseAssertion: "The Holy Scriptures, a New Translation from the Original Languages by J. N. Darby",
    scope: "all",
    scopeNote: "",
    expectedVerses: [31_030, 31_130],
  },
  {
    translationId: 6,
    code: "YLT",
    name: "Young's Literal Translation",
    language: "English",
    ebibleId: "engylt",
    license: "Public Domain",
    copyrightNotice:
      "Young's Literal Translation of the Holy Bible, by Robert Young. Public Domain. This " +
      "public domain Bible translation is brought to you courtesy of eBible.org.",
    licenseAssertion: "Young's Literal Translation",
    scope: "all",
    scopeNote: "",
    expectedVerses: [31_050, 31_150],
  },
  {
    translationId: 7,
    code: "JPS",
    name: "JPS TaNaKH (1917)",
    language: "English",
    ebibleId: "engjps",
    license: "Public Domain",
    copyrightNotice:
      "The Jewish Bible (Old Testament) in English, published by the Jewish Publication Society " +
      "in 1917. Public Domain. This copy of the Old JPS TaNaKH by the Jewish Publication Society " +
      "is brought to you courtesy of eBible.org. For the new JPS TaNaKH (1972, 1978, 1980), " +
      "please see jps.org.",
    licenseAssertion: "published by the Jewish Publication Society in 1917",
    scope: "OT",
    // Reader-facing, so it says what it is in words anyone can follow, and it does not call the
    // absence a fault: this translation is not incomplete, it is a translation of a different
    // (smaller) collection of books.
    scopeNote:
      "This is a Jewish translation of the Hebrew Bible, so it covers the Old Testament only. " +
      "The New Testament is not part of it.",
    expectedVerses: [23_000, 23_300],
    quirks: {
      // The 1917 JPS prints the HEBREW verse number in parentheses wherever it disagrees with
      // the English one — "(51-1) For the Leader. A Psalm of David" is English Ps 51:1 carrying
      // Hebrew Ps 51:1. That is verse numbering, not scripture, and AGENTS.md is explicit that
      // verse text is stored plain with no embedded verse numbers (character offsets for every
      // stored highlight depend on it). Nothing is lost by removing it: the same divergence is
      // already recorded structurally, in `versification_map` under the 'hebrew' scheme and in
      // `original_words.source_ref` for the Westminster Leningrad Codex.
      //
      // Verified before adoption: this pattern occurs 2,056 times in engjps and ZERO times in
      // the other four USFX sources, so it is not a shape that occurs in English scripture
      // prose — it is this edition's numbering apparatus and nothing else.
      pattern: /\(\d{1,3}-\d{1,3}\)\s*/g,
      replacement: "",
      expected: [1_900, 2_200],
      why: "JPS 1917 prints the Hebrew verse number inline where it differs from the English",
    },
  },
];

/**
 * Verses the `org` scheme addresses that the WEB distribution does not contain AT ALL.
 *
 * The canonical address space is built from WEB, and for the twelve best-known disputed New
 * Testament verses that works: WEB carries them as empty strings, so the address exists and
 * `verse_omissions` explains the gap. For these seven it does not — WEB simply skips the
 * number, so Acts 8 runs 1-40 with 39 verses in it.
 *
 * That made the canonical space incomplete in precisely the places a study tool most needs an
 * address. The King James prints all seven, Young's prints all seven, and Acts 8:37 is the most
 * discussed omitted verse in the New Testament. Without an id there is nowhere to put the text,
 * nowhere to hang a cross-reference (OpenBible has references into Romans 16:25-27), and no way
 * to render the apparatus that explains why the modern translations skip it.
 *
 * An explicit reviewed list rather than "the union of whatever the sources contain": a
 * data-driven union would let a future source invent verses into the canon with nobody
 * reading the diff. Each entry below was checked against the King James text.
 *
 * This is additive only. Existing verse ids keep their meaning, and user annotations — which
 * live in a different database and are never rebuilt — cannot be invalidated by adding an
 * address that previously resolved to nothing.
 */
export const CANONICAL_EXTRA_VERSES: readonly {
  bookId: number;
  chapter: number;
  verse: number;
  note: string;
}[] = [
  { bookId: 42, chapter: 17, verse: 36, note: "Luke 17:36 — printed by KJV/YLT; WEB skips the number entirely" },
  { bookId: 44, chapter: 8, verse: 37, note: "Acts 8:37 — the Ethiopian eunuch's confession; KJV/YLT print it" },
  { bookId: 44, chapter: 15, verse: 34, note: "Acts 15:34 — printed by KJV/YLT" },
  { bookId: 44, chapter: 24, verse: 7, note: "Acts 24:7 — printed by KJV/ASV/DBY/YLT" },
  { bookId: 45, chapter: 16, verse: 25, note: "Romans 16:25 — the doxology; WEB ends chapter 16 at verse 24" },
  { bookId: 45, chapter: 16, verse: 26, note: "Romans 16:26 — the doxology" },
  { bookId: 45, chapter: 16, verse: 27, note: "Romans 16:27 — the doxology" },
];

/**
 * Why a translation does not print a verse the canon addresses. Reader-facing, rendered in the
 * gap itself.
 *
 * Written for someone who has never opened a critical apparatus. "Critical text", "Byzantine"
 * and "attestation" are the trade's words for this and every one of them is useless to the
 * person actually reading the page. It must also not take a side: the manuscripts genuinely
 * disagree, translators genuinely disagree about what follows from that, and a reader who is
 * told a verse is "not really in the Bible" has been misinformed just as badly as one who is
 * told nothing.
 */
export const OMISSION_REASON_MANUSCRIPT =
  "This verse is not in the oldest surviving Greek copies of the New Testament; it appears in " +
  "copies made later. Translators disagree about which reading to follow, so some Bibles print " +
  "it and others leave it out.";

/**
 * What kind of gap a row in `verse_omissions` records. `coverage` is reserved for whole books a
 * translation does not include; that fact lives in `translation_books` and is never written per
 * verse.
 */
export type OmissionKind = "critical-text" | "versification" | "coverage" | "unexplained";

export const OMISSION_REASON_VERSIFICATION =
  "This edition follows the Septuagint's chapter and verse numbering, which differs from the " +
  "Hebrew numbering used for addresses here; this verse has no counterpart in it. The text is " +
  "not missing from the translation, only from this numbering.";

export const OMISSION_REASON_UNEXPLAINED =
  "This edition does not print this verse and the source data gives no explanation. It is " +
  "recorded so the gap is visible, not hidden.";

export interface OmissionExplanation {
  kind: OmissionKind;
  reason: string;
  /** A short, reader-facing account of the verse's likely transmission history. */
  history: string;
}

const OMISSION_HISTORY: Record<string, string> = {
  "40.17.21":
    "This wording closely parallels Mark 9:29, including the reference to prayer and fasting. " +
    "Many scholars therefore see it as a later Gospel-harmonizing addition. It is attested in " +
    "later Greek witnesses, but not in the earliest witnesses used by modern critical editions.",
  "40.18.11":
    "The sentence matches the secure saying in Luke 19:10. It appears to have entered some copies " +
    "as a harmonization, restoring a familiar saying at a place where Matthew's early text moves " +
    "directly from the parable to the next section.",
  "40.23.14":
    "This is substantially the same warning found in Mark 12:40 and Luke 20:47. It was likely " +
    "copied into Matthew to harmonize the parallel Gospel accounts, and is preserved mainly in " +
    "later witnesses rather than the earliest Greek evidence.",
  "41.7.16":
    "The short warning, 'If anyone has ears to hear, let him hear,' is a familiar saying elsewhere " +
    "in the Gospels. It likely entered some copies as a repeated editorial or liturgical conclusion " +
    "to Jesus' teaching about food.",
  "41.9.44":
    "This is a repetition of the warning that follows in Mark 9:48. A copyist or tradition may have " +
    "expanded the passage into a threefold refrain; the earliest witnesses move from verse 43 to 45.",
  "41.9.46":
    "Like verse 44, this repeats the warning preserved in verse 48. The threefold form was retained " +
    "in later copying, while the earliest witnesses omit the duplicate lines.",
  "41.11.26":
    "The sentence repeats Jesus' teaching in Matthew 6:15. It was probably added by harmonization " +
    "to make Mark agree with the parallel saying; later witnesses preserve it, while early witnesses " +
    "continue from verse 25 to verse 27.",
  "41.15.28":
    "The wording echoes Isaiah 53:12 and Luke 22:37. It appears to be a later cross-reference or " +
    "harmonization added to Mark's passion narrative, rather than a line present in the earliest " +
    "witnesses.",
  "42.23.17":
    "This explains the customary release of a prisoner at Passover, a detail also found in the " +
    "parallel passion accounts. It likely entered some copies through harmonization with Matthew " +
    "27:15 and Mark 15:6; early witnesses do not include it here.",
  "43.5.4":
    "The story about an angel stirring the pool explains the sick man's answer in verse 7. It is " +
    "widely understood as a marginal explanatory note that was copied into the text over time; the " +
    "earliest witnesses do not contain the explanation.",
  "44.28.29":
    "This is a brief closing summary of the Jewish visitors' disagreement with Paul. It reads like a " +
    "later narrative conclusion and is absent from early and important witnesses, though it became " +
    "part of the later textual tradition.",
  "45.16.24":
    "This benediction repeats the greeting already found at Romans 16:20. Its position varied as " +
    "copies circulated with different endings and doxologies; it was retained in the later tradition " +
    "but is absent from the earliest witnesses supporting the shorter ending.",
};

const DEFAULT_CRITICAL_TEXT_HISTORY =
  "The surviving manuscripts do not tell us the exact year this wording entered the tradition. " +
  "It is found in later witnesses, while earlier witnesses omit it; the difference reflects " +
  "centuries of hand-copying in which harmonizing, explanatory, and liturgical expansions could " +
  "be preserved alongside shorter readings. Modern editions weigh those witnesses rather than " +
  "assuming that a later reading was simply deleted.";

/**
 * Return the explanation stored beside an omitted verse, classified by kind. Only verses on a
 * reviewed list (`OMISSION_HISTORY`, `CANONICAL_EXTRA_VERSES`) are attributed to the Greek
 * manuscript tradition; a gap in an edition with its own numbering is a numbering difference;
 * anything else is recorded as unexplained rather than given a story it has not earned.
 * `translation` is undefined for WEB and BSB, which are not USFX sources and use canonical
 * numbering. No exact insertion year is claimed: manuscripts can date the surviving evidence,
 * not the moment a reading first entered the tradition.
 */
export function omissionExplanation(
  translation: Pick<TranslationSource, "versification"> | undefined,
  verseId: number,
): OmissionExplanation {
  const book = Math.floor(verseId / 1_000_000);
  const chapter = Math.floor((verseId % 1_000_000) / 1_000);
  const verse = verseId % 1_000;
  const history = OMISSION_HISTORY[`${book}.${chapter}.${verse}`];
  const reviewedExtra = CANONICAL_EXTRA_VERSES.some(
    (e) => e.bookId === book && e.chapter === chapter && e.verse === verse,
  );
  if (history !== undefined || reviewedExtra) {
    return {
      kind: "critical-text",
      reason: OMISSION_REASON_MANUSCRIPT,
      history: history ?? DEFAULT_CRITICAL_TEXT_HISTORY,
    };
  }
  if ((translation?.versification ?? "org") !== "org" && book < 40) {
    return { kind: "versification", reason: OMISSION_REASON_VERSIFICATION, history: "" };
  }
  return { kind: "unexplained", reason: OMISSION_REASON_UNEXPLAINED, history: "" };
}

/*
 * There is deliberately no `outOfScopeReason()` here any more.
 *
 * It composed "<name> does not include this book. <scopeNote>" and the ingest wrote the result
 * into `verse_omissions` once per verse — 7,957 identical copies of one sentence for the JPS
 * New Testament alone. Scope is now a per-book fact (`translation_books`) and the sentence is
 * a per-passage rendering, so it is composed where it is rendered, from `translations.name`
 * and `translations.scope_note`, which are already in the database and already in the build
 * fingerprint. Reader copy that the ingest cannot see is reader copy the ingest cannot
 * duplicate 7,957 times.
 */
