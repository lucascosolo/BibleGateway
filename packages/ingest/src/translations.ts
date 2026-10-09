import type { PlainSourceId } from "./outside-plain.js";

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

export function unplacedGateErrors(
  t: Pick<TranslationSource, "code" | "unplacedSourceVerses" | "reviewedUnplacedCount">,
  skipped: number,
): string[] {
  const errors: string[] = [];
  const reviewed = t.reviewedUnplacedCount ?? 0;
  const listed = t.unplacedSourceVerses?.length ?? 0;
  if (skipped !== reviewed) {
    errors.push(
      `${t.code}: skipped ${skipped} unplaced source verse(s), the review accounts for ${reviewed}. ` +
        `Unplaced verses are not stored, so a change here hides or reveals source text; ` +
        `re-review and update reviewedUnplacedCount.`,
    );
  }
  if (skipped !== listed) {
    errors.push(`${t.code}: skipped ${skipped} unplaced source verse(s), the list names ${listed}; an entry is not in the source`);
  }
  return errors;
}

/** Canonical ids in a printed, in-scope book that have neither text nor an omission row. */
export function unexplainedGaps(
  canonicalVerseIds: Iterable<number>,
  t: { scope: TranslationScope; printedBookIds: ReadonlySet<number>; explained: ReadonlySet<number> },
): number[] {
  const gaps: number[] = [];
  for (const id of canonicalVerseIds) {
    const book = Math.floor(id / 1_000_000);
    const inScope = book > 66 || t.scope === "all" || (t.scope === "OT" ? book <= 39 : book >= 40);
    if (inScope && t.printedBookIds.has(book) && !t.explained.has(id)) gaps.push(id);
  }
  return gaps.sort((a, b) => a - b);
}

/** 'all' = protocanon complete; 'OT'/'NT' = one testament; 'outside' = outside books only. */
export type TranslationScope = "all" | "OT" | "NT" | "outside";

export interface TranslationSource {
  /** Fixed. Ends up in verse_texts, verse_omissions and user annotations — never renumber. */
  translationId: number;
  code: string;
  name: string;
  language: string;
  /** eBible.org translation id; also the zip basename. Absent for a plain-text edition. */
  ebibleId?: string;
  translator?: string;
  year?: string;
  /** Where the licence (or the date that establishes it) can be read. */
  licenseUrl?: string;
  /** A plain-text outside edition, loaded through outside-plain.ts instead of USFX. */
  plain?: readonly PlainSourceRef[];
  license: string;
  /** Transcribed from the distribution's copr.htm. Rendered under every passage. */
  copyrightNotice: string;
  /**
   * A phrase that MUST appear in the distribution's own copr.htm. The build fails if it does
   * not, so an upstream licence change cannot pass unnoticed — which is the whole reason the
   * parser returns the file rather than us pasting from it once and forgetting.
   */
  licenseAssertion: string;
  scope: TranslationScope;
  /** Also loads the outside books this edition prints (see outside.ts). */
  outsideBooks?: boolean;
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
  /**
   * Exact number of unplaced source verses the review accounts for. Held apart from the list so
   * that adding an entry cannot raise both sides of the gate at once: unplaced verses write no
   * omission row, so a list allowed to grow would hide source text silently.
   */
  reviewedUnplacedCount?: number;
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

export interface PlainSourceRef {
  id: PlainSourceId;
  /** Relative to the filed sources directory (~/.cache/jot/sources/outside). */
  file: string;
  format: "tab" | "mattison-html";
  /** The reviewed (for OCR texts, proofread) file; any other content fails the build. */
  sha256: string;
  url: string;
  /** A filed licence evidence file and a phrase it must still contain. */
  licenceEvidence: readonly [file: string, phrase: string];
}

const MATTISON_DEDICATION = "committed to the public domain and may be freely copied and used, changed or unchanged, for any purpose";
const CCEL_PD = "<DC.Rights>Public Domain</DC.Rights>";

/** The Second Temple, New Testament apocrypha and Apostolic Fathers texts (chunk 4). */
const PLAIN_SOURCES: readonly TranslationSource[] = [
  {
    translationId: 10,
    code: "CHARLES",
    name: "R. H. Charles's Pseudepigrapha",
    language: "English",
    translator: "R. H. Charles",
    year: "1913-1918",
    license: "Public Domain (published 1913-1918; the translator died in 1931)",
    licenseUrl: "https://en.wikipedia.org/wiki/R._H._Charles",
    copyrightNotice:
      "Translated by R. H. Charles: The Book of Enoch (SPCK, 1917); The Book of Jubilees (The " +
      "Apocrypha and Pseudepigrapha of the Old Testament, Oxford, 1913); The Testaments of the " +
      "Twelve Patriarchs (SPCK, 1917); The Apocalypse of Baruch (SPCK, 1918). Public domain. The " +
      "Testaments and 2 Baruch were proofread against the printed pages in 2026.",
    licenseAssertion: "PD/US|1931",
    scope: "outside",
    scopeNote:
      "R. H. Charles's translations of 1 Enoch, Jubilees, the Testaments of the Twelve Patriarchs " +
      "(Testament of Reuben, Testament of Simeon, Testament of Levi, Testament of Judah, Testament " +
      "of Issachar, Testament of Zebulun, Testament of Dan, Testament of Naphtali, Testament of " +
      "Gad, Testament of Asher, Testament of Joseph, Testament of Benjamin) and 2 Baruch, in " +
      "Charles's chapter and verse numbering. The prologue of Jubilees is verse 0 of chapter 1. " +
      "The Testament of Levi has no 6:3 and the Testament of Zebulun no 4:4 because the printed " +
      "edition has no verse with those numbers.",
    expectedVerses: [4_065, 4_065],
    includedBookIds: [...range(85, 98), 100],
    plain: [
      { id: "charles-1enoch", file: "charles-1enoch/text.txt", format: "tab", sha256: "65a7448a300400dc4729b76b277acb691339060be0fde0c523c2ffd50e181b97", url: "https://en.wikisource.org/wiki/The_Book_of_Enoch_(Charles)", licenceEvidence: ["charles-1enoch/licence-wikisource-root.wiki", "PD/US|1931"] },
      { id: "charles-jubilees", file: "charles-jubilees/text.txt", format: "tab", sha256: "8d2b36d0f1d69fc00d45f05a97d5e06d18a44c1a71a3800b69b309fa6097fa1f", url: "https://www.pseudepigrapha.com/jubilees/index.htm", licenceEvidence: ["charles-jubilees/licence-wikipedia-charles.html", "1855-1931"] },
      { id: "charles-testaments", file: "charles-testaments/text.proofread.txt", format: "tab", sha256: "50aabf81728e6453a4acc6fc458d941897ab23055986eeed39e5b93000bb2525", url: "https://archive.org/details/testamentsoftwel00char", licenceEvidence: ["charles-testaments/archive-metadata.json", '"date":"1917"'] },
      { id: "charles-2baruch", file: "charles-2baruch/text.proofread.txt", format: "tab", sha256: "ee162e7b79394e5f2543ce737c1f34cf0902f0b272495a4e02a97a888dd375d5", url: "https://archive.org/details/apocalypseofbaru00cha", licenceEvidence: ["charles-2baruch/archive-metadata.json", '"date":"1918"'] },
    ],
  },
  {
    translationId: 11,
    code: "GRAY",
    name: "G. Buchanan Gray's Psalms of Solomon",
    language: "English",
    translator: "G. Buchanan Gray",
    year: "1913",
    license: "Public Domain (published 1913; the translator died in 1922)",
    licenseUrl: "https://archive.org/details/Charles_The-Apocrypha-of-the-Old-Testament-vol-2_1913",
    copyrightNotice:
      "Translated by G. Buchanan Gray, in R. H. Charles (ed.), The Apocrypha and Pseudepigrapha of " +
      "the Old Testament, vol. 2 (Oxford, 1913), pp. 631-652. Public domain. Proofread against the " +
      "printed pages in 2026.",
    licenseAssertion: '"date":"1913"',
    scope: "outside",
    scopeNote:
      "The Psalms of Solomon in G. Buchanan Gray's translation, psalm and verse in Gray's own " +
      "numbering. The edition prints no 13:6. Twelve verse numbers in Psalms 17 and 18 are cut off " +
      "in the scan and were assigned from the Greek numbering and Gray's notes.",
    expectedVerses: [328, 328],
    includedBookIds: [99],
    plain: [
      { id: "gray-psalms-solomon", file: "gray-psalms-solomon/text.proofread.txt", format: "tab", sha256: "a1f06c10e96ae38b59d85f5db182529de36c34eb279ca95fbb6c81c65e831e86", url: "https://archive.org/details/Charles_The-Apocrypha-of-the-Old-Testament-vol-2_1913", licenceEvidence: ["gray-psalms-solomon/archive-metadata.json", '"date":"1913"'] },
    ],
  },
  {
    translationId: 12,
    code: "MATTISON",
    name: "Mark M. Mattison's Gospels",
    language: "English",
    translator: "Mark M. Mattison",
    year: "undated (gospels.net, accessed 2026-10-09)",
    license: "Public domain dedication by the translator",
    licenseUrl: "https://www.gospels.net/thomas/",
    copyrightNotice:
      "Translated by Mark M. Mattison (gospels.net). The translator has committed these " +
      "translations to the public domain: they may be freely copied and used, changed or " +
      "unchanged, for any purpose.",
    licenseAssertion: MATTISON_DEDICATION,
    scope: "outside",
    scopeNote:
      "Mark M. Mattison's translations of the Gospel of Thomas (logia 1-114 of the Coptic Gospel " +
      "of Thomas, with the prologue as logion 0), the Gospel of Mary, the Gospel of Judas and the " +
      "Gospel of Philip. Mary, Judas and Philip are numbered by the manuscript page Mattison prints " +
      "(Mary 7-10 and 15-19, the other pages being lost; Judas 33-58; Philip 51-86); the verse is " +
      "the passage's place on that page, counted here, not printed by the translator.",
    expectedVerses: [376, 376],
    includedBookIds: [101, 107, 108, 109],
    plain: [
      { id: "mattison-thomas", file: "mattison-thomas/text.txt", format: "tab", sha256: "36417c4cd1671561839ed9aa6f2813a066d1ff15957d1eecfee5055947abad22", url: "https://www.gospels.net/thomas/", licenceEvidence: ["mattison-thomas/index.html", MATTISON_DEDICATION] },
      { id: "mattison-mary", file: "described-works/gospels-net-mary.html", format: "mattison-html", sha256: "1fbf26b9c23f48a901b20625bba37e6e79a22ca18f16c036bd52976a36376293", url: "https://www.gospels.net/mary", licenceEvidence: ["described-works/gospels-net-mary.html", MATTISON_DEDICATION] },
      { id: "mattison-judas", file: "described-works/gospels-net-judas.html", format: "mattison-html", sha256: "d8ed61e43f25ecfd29a55fb657a0e4b54f7799a65b655c952a84398a40328efc", url: "https://www.gospels.net/judas", licenceEvidence: ["described-works/gospels-net-judas.html", MATTISON_DEDICATION] },
      { id: "mattison-philip", file: "described-works/gospels-net-philip.html", format: "mattison-html", sha256: "b71f86fb08060c94984300a035919ff62ea07159a08ce0273c1b15ec69359168", url: "https://www.gospels.net/philip", licenceEvidence: ["described-works/gospels-net-philip.html", MATTISON_DEDICATION] },
    ],
  },
  {
    translationId: 13,
    code: "ANF",
    name: "Ante-Nicene Fathers Apocrypha",
    language: "English",
    translator: "J. Armitage Robinson (Gospel of Peter); Alexander Walker (the others)",
    year: "1870-1896",
    license: "Public Domain (published 1870-1896)",
    licenseUrl: "https://www.ccel.org/ccel/schaff/anf08.html",
    copyrightNotice:
      "From the Ante-Nicene Fathers (American edition, vols. 8 and 9, 1886 and 1896): the Gospel of " +
      "Peter translated by J. Armitage Robinson; the Protevangelium of James, the Infancy Gospel of " +
      "Thomas and the Acts of Paul and Thecla translated by Alexander Walker (1870). Public domain; " +
      "text from the Christian Classics Ethereal Library.",
    licenseAssertion: CCEL_PD,
    scope: "outside",
    scopeNote:
      "The Gospel of Peter, the Protevangelium of James, the Infancy Gospel of Thomas and the Acts " +
      "of Paul and Thecla, from the Ante-Nicene Fathers. The Gospel of Peter is in Robinson's " +
      "sections 1-14 (the finer verse numbers are not printed there). The Protevangelium is one unit " +
      "per chapter. The Infancy Gospel of Thomas is one unit per chapter of each form: the first " +
      "Greek form as chapters 1-19, the second as 101-111, the Latin as 201-215. The Acts of Paul and " +
      "Thecla print no numbers at all; its paragraphs are counted here in order, 1-29 as chapter 1 " +
      "and the ending from Grabe's manuscript as chapter 2.",
    expectedVerses: [114, 114],
    includedBookIds: [102, 103, 104, 105],
    plain: [
      { id: "robinson-gospel-peter", file: "robinson-gospel-peter/text.txt", format: "tab", sha256: "706188d5ddff78d9eaa435b15cfefcac1450184d0590efa8c5957698ae5a7c5a", url: "https://www.ccel.org/ccel/schaff/anf09.html", licenceEvidence: ["robinson-gospel-peter/anf09.xml", CCEL_PD] },
      { id: "walker-protevangelium", file: "walker-protevangelium/text.txt", format: "tab", sha256: "785ab97036618dfded205687dc6eff4edf17dea067cd50bab2354eac38c585a5", url: "https://www.ccel.org/ccel/schaff/anf08.html", licenceEvidence: ["walker-protevangelium/anf08.xml", CCEL_PD] },
      { id: "walker-infancy-thomas", file: "walker-infancy-thomas/text.txt", format: "tab", sha256: "a237c9285d87792238d08de1c55fe837a60f0d1c184084ca924fa64aaf084690", url: "https://www.ccel.org/ccel/schaff/anf08.html", licenceEvidence: ["walker-infancy-thomas/anf08.xml", CCEL_PD] },
      { id: "walker-thecla", file: "walker-thecla/text.txt", format: "tab", sha256: "7657e36050b367e31509373af99f101fdfd1a124fd467f4e6e0eb504a9d23681", url: "https://www.ccel.org/ccel/schaff/anf08.html", licenceEvidence: ["walker-thecla/anf08.xml", CCEL_PD] },
    ],
  },
  {
    translationId: 14,
    code: "JAMES1924",
    name: "M. R. James's Apocalypse of Peter",
    language: "English",
    translator: "M. R. James",
    year: "1924",
    license: "Public Domain (published 1924; the translator died in 1936)",
    licenseUrl: "https://en.wikisource.org/wiki/The_Apocryphal_New_Testament_(1924)/Apocalypses/The_Apocalypse_of_Peter",
    copyrightNotice:
      "Translated by M. R. James, The Apocryphal New Testament (Oxford: Clarendon Press, 1924). " +
      "Public domain; transcription from Wikisource.",
    licenseAssertion: "PD/US|1936",
    scope: "outside",
    scopeNote:
      "The Apocalypse of Peter from M. R. James's Apocryphal New Testament: the Akhmim Greek fragment " +
      "as chapter 1, verses 1-34 as James prints them, and the Ethiopic text as chapter 2, whose 51 " +
      "paragraphs James does not number; they are counted here in order.",
    expectedVerses: [85, 85],
    includedBookIds: [106],
    plain: [
      { id: "james-apocalypse-peter", file: "james-apocalypse-peter/text.txt", format: "tab", sha256: "9a0907ebe9e95140111d38975cdf9fc298129d1705e72777956fe06a58d291f6", url: "https://en.wikisource.org/wiki/The_Apocryphal_New_Testament_(1924)/Apocalypses/The_Apocalypse_of_Peter", licenceEvidence: ["james-apocalypse-peter/index-1924.raw.wiki", "PD/US|1936"] },
    ],
  },
  {
    translationId: 15,
    code: "LIGHTFOOT",
    name: "Lightfoot-Harmer Apostolic Fathers",
    language: "English",
    translator: "J. B. Lightfoot and J. R. Harmer",
    year: "1891",
    license: "Public Domain (published 1891; the editors died in 1889 and 1944)",
    licenseUrl: "https://www.ccel.org/ccel/lightfoot/fathers.html",
    copyrightNotice:
      "From The Apostolic Fathers, ed. J. B. Lightfoot and J. R. Harmer (London: Macmillan, 1891): " +
      "1 Clement and Ignatius translated by Lightfoot; the Didache, Barnabas and Hermas completed by " +
      "Harmer from Lightfoot's notes. Public domain; text from the Christian Classics Ethereal Library.",
    licenseAssertion: CCEL_PD,
    scope: "outside",
    scopeNote:
      "The Didache, 1 Clement, the seven letters of Ignatius (Ignatius to the Ephesians, Ignatius to " +
      "the Magnesians, Ignatius to the Trallians, Ignatius to the Romans, Ignatius to the " +
      "Philadelphians, Ignatius to the Smyrnaeans, Ignatius to Polycarp), the Epistle of Barnabas " +
      "and the Shepherd of Hermas, from the 1891 Lightfoot-Harmer edition. Each chapter is one unit, " +
      "because the 1891 verse numbers are not in the transcription; the opening greeting of 1 Clement " +
      "and of each letter of Ignatius is verse 0 of chapter 1. Hermas is one unit per Vision (1-5), " +
      "Mandate (1-12, as chapters 101-112) and Parable (1-10, as chapters 201-210).",
    expectedVerses: [228, 228],
    includedBookIds: range(110, 120),
    plain: [
      { id: "lightfoot-didache", file: "lightfoot-didache/text.txt", format: "tab", sha256: "9885d5649f247e5e8478f2722cff052587aff71d358bcc9e46dcbb525829501d", url: "https://www.ccel.org/ccel/lightfoot/fathers.html", licenceEvidence: ["lightfoot-didache/ccel-lightfoot-fathers.xml", CCEL_PD] },
      { id: "lightfoot-1clement", file: "lightfoot-1clement/text.txt", format: "tab", sha256: "3d87c3741ac1afa72a80f51726e10088ad9c83cc56e0221224e9a6b70973fe31", url: "https://www.ccel.org/ccel/lightfoot/fathers.html", licenceEvidence: ["lightfoot-1clement/ccel-lightfoot-fathers.xml", CCEL_PD] },
      { id: "lightfoot-ignatius", file: "lightfoot-ignatius/text.txt", format: "tab", sha256: "e0a1418fbd330104091a077cd3928329c7678098c19c8150906466cfb6fde353", url: "https://www.ccel.org/ccel/lightfoot/fathers.html", licenceEvidence: ["lightfoot-ignatius/ccel-lightfoot-fathers.xml", CCEL_PD] },
      { id: "lightfoot-barnabas", file: "lightfoot-barnabas/text.txt", format: "tab", sha256: "9193921d3e7017b71f33c9f08b7ce55f0c6be46738866e3020bf53ba7e33c67f", url: "https://www.ccel.org/ccel/lightfoot/fathers.html", licenceEvidence: ["lightfoot-barnabas/ccel-lightfoot-fathers.xml", CCEL_PD] },
      { id: "lightfoot-hermas", file: "lightfoot-hermas/text.txt", format: "tab", sha256: "dd00830803891feeaf9171b2331c6f9128ddc3e71f80dc1748a6fa1f2e93e2c7", url: "https://www.ccel.org/ccel/lightfoot/fathers.html", licenceEvidence: ["lightfoot-hermas/ccel-lightfoot-fathers.xml", CCEL_PD] },
    ],
  },
];

export const TRANSLATION_SOURCES: readonly TranslationSource[] = [
  {
    translationId: 8,
    code: "LXX",
    name: "Brenton's Septuagint (selected books)",
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
      "until their differing Greek verse systems have a separately reviewed mapping. It also " +
      "prints the Septuagint's books outside the Hebrew Bible (Tobit to Psalm 151); for most of " +
      "them Brenton's edition reprints the Authorized Version's English under Septuagint numbering, " +
      "and 3 and 4 Maccabees and Psalm 151 are Brenton's own translation.",
    expectedVerses: [11_900, 11_950],
    outsideBooks: true,
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
    includedBookIds: [1, 2, 3, 4, 5, 16, 25, 35, 37, ...range(67, 83)],
    // Gen 2, Exod 63, Lev 1, Num 2, Deut 1, Nehemiah and Lamentations 21; and 57 in the outside
    // books where the KJV Apocrypha has a verse Brenton does not (Additions to Esther 19,
    // Prayer of Azariah 3, Sirach 35), all from the reviewed tables in outside-maps.ts.
    versificationOmissions: 147,
    reviewedUnplacedCount: 16,
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
    translationId: 9,
    code: "KJVA",
    name: "King James Version Apocrypha",
    language: "English",
    ebibleId: "eng-kjv",
    license: "Public Domain (see notice: UK Crown letters patent)",
    // Transcribed from eng-kjv/copr.htm (the "+ Apocrypha" edition), letters-patent paragraph in
    // full for the reason given on KJV above.
    copyrightNotice:
      "The King James Version or Authorized Version of the Holy Bible, using the standardized " +
      "text of 1769, with Apocrypha/Deuterocanon. Public Domain. Letters patent issued by King " +
      "James with no expiration date means that to print this translation in the United Kingdom " +
      "or import printed copies into the UK, you need permission. Currently, the Cambridge " +
      "University Press, the Oxford University Press, and Collins have the exclusive right to " +
      "print this Bible translation in the UK. This royal decree has no effect outside of the UK, " +
      "where this work is firmly in the Public Domain. This free text of the King James Version " +
      "of the Holy Bible is brought to you courtesy of the Crosswire Bible Society and eBible.org.",
    licenseAssertion: "using the standardized text of 1769, with Apocrypha/Deuterocanon",
    scope: "outside",
    scopeNote:
      "This is the Apocrypha of the King James Version (1611, in the standardized text of 1769): " +
      "the books printed between the Testaments in the Authorized Version, from 1 Esdras to " +
      "2 Maccabees. The Old and New Testaments are the separate King James Version. It has no " +
      "3 or 4 Maccabees and no Psalm 151, and three verses of Sirach whose numbers hold other " +
      "text in the Greek numbering used here are not shown.",
    expectedVerses: [5_700, 5_740],
    includedBookIds: [...range(67, 78), 81, 82, 84],
    versification: "kjva",
    outsideBooks: true,
    // Tobit 10:8 (Brenton has one more verse there) and Sirach 20:3, 22:9, 22:10 (KJVA_UNPLACED).
    versificationOmissions: 4,
    reviewedUnplacedCount: 3,
    unplacedSourceVerses: [
      { bookId: 71, chapter: 20, verse: 3 },
      { bookId: 71, chapter: 22, verse: 9 },
      { bookId: 71, chapter: 22, verse: 10 },
    ],
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
  ...PLAIN_SOURCES,
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
  { bookId: 45, chapter: 16, verse: 25, note: "Romans 16:25 — the doxology; WEB's source ends chapter 16 at 24 (see WEB_WELDED_VERSES)" },
  { bookId: 45, chapter: 16, verse: 26, note: "Romans 16:26 — the doxology" },
  { bookId: 45, chapter: 16, verse: 27, note: "Romans 16:27 — the doxology" },
];

export interface WeldedVerse {
  bookId: number;
  chapter: number;
  verse: number;
  /** Each part starts at its anchor and runs to the next anchor or the end of the source text. */
  parts: readonly { anchor: string; chapter: number; verse: number }[];
  note: string;
}

/**
 * WEB source verses whose text carries other canonical verses. The web.json distribution has no
 * Romans 16:25-27 labels: it prints the doxology inside 14:23, where some manuscripts place it.
 * The doxology is in P61, Sinaiticus and Vaticanus, so recording 16:25-27 as a critical-text
 * omission would misinform; the text goes to its canonical address and the map row says where
 * WEB prints it. Anchors checked against the published WEB verse divisions of Romans 16:25-27.
 */
export const WEB_WELDED_VERSES: readonly WeldedVerse[] = [
  {
    bookId: 45,
    chapter: 14,
    verse: 23,
    parts: [
      { anchor: "Now to him who is able to establish you", chapter: 16, verse: 25 },
      { anchor: "but now is revealed", chapter: 16, verse: 26 },
      { anchor: "to the only wise God", chapter: 16, verse: 27 },
    ],
    note: "WEB prints the doxology (Romans 16:25-27) after Romans 14:23, inside that verse",
  },
];

export function splitWeldedVerse(
  text: string,
  w: WeldedVerse,
): { chapter: number; verse: number; text: string }[] {
  const cuts = w.parts.map((p) => {
    const at = text.indexOf(p.anchor);
    if (at < 0 || text.indexOf(p.anchor, at + 1) >= 0) {
      throw new Error(`${w.bookId}.${w.chapter}.${w.verse}: anchor "${p.anchor}" must occur exactly once`);
    }
    return at;
  });
  cuts.forEach((c, i) => {
    if (i > 0 && c <= cuts[i - 1]) throw new Error(`${w.bookId}.${w.chapter}.${w.verse}: anchors out of order`);
  });
  const bounds = [0, ...cuts, text.length];
  const targets = [{ chapter: w.chapter, verse: w.verse }, ...w.parts];
  return targets.map((t, i) => {
    const piece = text.slice(bounds[i], bounds[i + 1]);
    if (piece.trim().length === 0) throw new Error(`${w.bookId}.${t.chapter}.${t.verse}: empty piece after split`);
    return { chapter: t.chapter, verse: t.verse, text: piece };
  });
}

/** `unexplained` rows mean a gap nobody reviewed; none is allowed to ship. */
export function unexplainedOmissionErrors(code: string, count: number): string[] {
  return count === 0
    ? []
    : [`${code}: ${count} omission row(s) of kind 'unexplained'. Find why the verse is missing and classify or fix it.`];
}

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
export const OMISSION_REASON_EDITION =
  "This edition has no separate verse at this number: it joins this text to a neighbouring " +
  "verse, numbers the passage differently, or translates a form of the book without it.";

export function omissionExplanation(
  translation: Pick<TranslationSource, "versification"> | undefined,
  verseId: number,
): OmissionExplanation {
  const book = Math.floor(verseId / 1_000_000);
  const chapter = Math.floor((verseId % 1_000_000) / 1_000);
  const verse = verseId % 1_000;
  if (book > 66) return { kind: "versification", reason: OMISSION_REASON_EDITION, history: "" };
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

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// --- The outside books ------------------------------------------------------------------
//
// Books outside the 66 take ids from 67 upward, so `verse_id` and the one renderer carry over
// unchanged. FIXED: an id ends up in annotations; never renumber, only append. Allocated before
// their text is ingested (status "allocated", chapter_count 0) so the id space is settled once.
// Brenton's order for the Septuagint's books, then 2 Esdras (printed by the KJV Apocrypha only),
// the Second Temple writings, the New Testament apocrypha and the Apostolic Fathers. The
// Testaments of the Twelve Patriarchs and Ignatius's letters are one book per testament and per
// letter, because each source restarts its chapters for each.
//
// `numbering` says how chapter and verse are used, so the reader can label a reference:
//   chapter-verse  ordinary chapter:verse; verse 0 of chapter 1 is a prologue
//   logion         one chapter; the verse is the saying number (Thomas 42 = 1:42)
//   section        one chapter; the verse is the section number (Gospel of Peter)
//   chapter        the source numbers chapters only; each chapter is verse 1 of that chapter
//   part-chapter   parts banded by hundreds, verse 1 (Hermas: Vision n = n, Mandate n = 100+n,
//                  Parable n = 200+n; Infancy Thomas: Greek A n = n, Greek B = 100+n, Latin = 200+n)
//   page           chapter = the manuscript page the translation prints; verse = the passage's
//                  place on that page, counted here (Mattison's Mary, Judas, Philip)
//   paragraph      the source prints no numbers; editorial ordinals (Thecla; Apocalypse of Peter's
//                  Ethiopic, as chapter 2 after the Akhmim fragment's chapter 1)

export type Canon = "hebrew" | "nt" | "deuterocanon" | "pseudepigrapha" | "nt-apocrypha" | "apostolic";
export type Numbering = "chapter-verse" | "logion" | "section" | "chapter" | "part-chapter" | "paragraph" | "page";

export interface OutsideBook {
  bookId: number;
  osisId: string;
  name: string;
  abbreviation: string;
  canon: Exclude<Canon, "hebrew" | "nt">;
  numbering: Numbering;
  status: "ingested" | "allocated";
}

const book = (
  bookId: number, osisId: string, name: string, abbreviation: string,
  canon: OutsideBook["canon"], numbering: Numbering = "chapter-verse", status: OutsideBook["status"] = "allocated",
): OutsideBook => ({ bookId, osisId, name, abbreviation, canon, numbering, status });

export const OUTSIDE_BOOKS: readonly OutsideBook[] = [
  book(67, "Tob", "Tobit", "Tob", "deuterocanon", "chapter-verse", "ingested"),
  book(68, "Jdt", "Judith", "Jdt", "deuterocanon", "chapter-verse", "ingested"),
  book(69, "AddEsth", "Additions to Esther", "Add Esth", "deuterocanon", "chapter-verse", "ingested"),
  book(70, "Wis", "Wisdom of Solomon", "Wis", "deuterocanon", "chapter-verse", "ingested"),
  book(71, "Sir", "Sirach", "Sir", "deuterocanon", "chapter-verse", "ingested"),
  book(72, "Bar", "Baruch", "Bar", "deuterocanon", "chapter-verse", "ingested"),
  book(73, "EpJer", "Letter of Jeremiah", "Ep Jer", "deuterocanon", "chapter-verse", "ingested"),
  book(74, "PrAzar", "Prayer of Azariah", "Pr Azar", "deuterocanon", "chapter-verse", "ingested"),
  book(75, "Sus", "Susanna", "Sus", "deuterocanon", "chapter-verse", "ingested"),
  book(76, "Bel", "Bel and the Dragon", "Bel", "deuterocanon", "chapter-verse", "ingested"),
  book(77, "1Macc", "1 Maccabees", "1 Macc", "deuterocanon", "chapter-verse", "ingested"),
  book(78, "2Macc", "2 Maccabees", "2 Macc", "deuterocanon", "chapter-verse", "ingested"),
  book(79, "3Macc", "3 Maccabees", "3 Macc", "deuterocanon", "chapter-verse", "ingested"),
  book(80, "4Macc", "4 Maccabees", "4 Macc", "deuterocanon", "chapter-verse", "ingested"),
  book(81, "1Esd", "1 Esdras", "1 Esd", "deuterocanon", "chapter-verse", "ingested"),
  book(82, "PrMan", "Prayer of Manasseh", "Pr Man", "deuterocanon", "chapter-verse", "ingested"),
  book(83, "Ps151", "Psalm 151", "Ps 151", "deuterocanon", "chapter-verse", "ingested"),
  book(84, "2Esd", "2 Esdras", "2 Esd", "deuterocanon", "chapter-verse", "ingested"),
  book(85, "1En", "1 Enoch", "1 En", "pseudepigrapha", "chapter-verse", "ingested"),
  book(86, "Jub", "Jubilees", "Jub", "pseudepigrapha", "chapter-verse", "ingested"),
  book(87, "TReu", "Testament of Reuben", "T. Reu.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(88, "TSim", "Testament of Simeon", "T. Sim.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(89, "TLevi", "Testament of Levi", "T. Levi", "pseudepigrapha", "chapter-verse", "ingested"),
  book(90, "TJud", "Testament of Judah", "T. Jud.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(91, "TIss", "Testament of Issachar", "T. Iss.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(92, "TZeb", "Testament of Zebulun", "T. Zeb.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(93, "TDan", "Testament of Dan", "T. Dan", "pseudepigrapha", "chapter-verse", "ingested"),
  book(94, "TNaph", "Testament of Naphtali", "T. Naph.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(95, "TGad", "Testament of Gad", "T. Gad", "pseudepigrapha", "chapter-verse", "ingested"),
  book(96, "TAsh", "Testament of Asher", "T. Ash.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(97, "TJos", "Testament of Joseph", "T. Jos.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(98, "TBenj", "Testament of Benjamin", "T. Benj.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(99, "PssSol", "Psalms of Solomon", "Pss. Sol.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(100, "2Bar", "2 Baruch", "2 Bar.", "pseudepigrapha", "chapter-verse", "ingested"),
  book(101, "GThom", "Gospel of Thomas", "Gos. Thom.", "nt-apocrypha", "logion", "ingested"),
  book(102, "GPet", "Gospel of Peter", "Gos. Pet.", "nt-apocrypha", "section", "ingested"),
  book(103, "ProtJas", "Protevangelium of James", "Prot. Jas.", "nt-apocrypha", "chapter", "ingested"),
  book(104, "InfThom", "Infancy Gospel of Thomas", "Inf. Gos. Thom.", "nt-apocrypha", "part-chapter", "ingested"),
  book(105, "PlThec", "Acts of Paul and Thecla", "Acts Paul Thec.", "nt-apocrypha", "paragraph", "ingested"),
  book(106, "ApocPet", "Apocalypse of Peter", "Apoc. Pet.", "nt-apocrypha", "paragraph", "ingested"),
  book(107, "GMary", "Gospel of Mary", "Gos. Mary", "nt-apocrypha", "page", "ingested"),
  book(108, "GJudas", "Gospel of Judas", "Gos. Jud.", "nt-apocrypha", "page", "ingested"),
  book(109, "GPhil", "Gospel of Philip", "Gos. Phil.", "nt-apocrypha", "page", "ingested"),
  book(110, "Did", "Didache", "Did.", "apostolic", "chapter", "ingested"),
  book(111, "1Clem", "1 Clement", "1 Clem.", "apostolic", "chapter", "ingested"),
  book(112, "IgnEph", "Ignatius to the Ephesians", "Ign. Eph.", "apostolic", "chapter", "ingested"),
  book(113, "IgnMagn", "Ignatius to the Magnesians", "Ign. Magn.", "apostolic", "chapter", "ingested"),
  book(114, "IgnTrall", "Ignatius to the Trallians", "Ign. Trall.", "apostolic", "chapter", "ingested"),
  book(115, "IgnRom", "Ignatius to the Romans", "Ign. Rom.", "apostolic", "chapter", "ingested"),
  book(116, "IgnPhld", "Ignatius to the Philadelphians", "Ign. Phld.", "apostolic", "chapter", "ingested"),
  book(117, "IgnSmyrn", "Ignatius to the Smyrnaeans", "Ign. Smyrn.", "apostolic", "chapter", "ingested"),
  book(118, "IgnPol", "Ignatius to Polycarp", "Ign. Pol.", "apostolic", "chapter", "ingested"),
  book(119, "Barn", "Epistle of Barnabas", "Barn.", "apostolic", "chapter", "ingested"),
  book(120, "Herm", "Shepherd of Hermas", "Herm.", "apostolic", "part-chapter", "ingested"),
];

/** The canon a book id belongs to: the Hebrew Bible 1-39, the New Testament 40-66, else the table. */
export function canonOf(bookId: number): Canon {
  if (bookId >= 1 && bookId <= 39) return "hebrew";
  if (bookId >= 40 && bookId <= 66) return "nt";
  const b = OUTSIDE_BOOKS.find((x) => x.bookId === bookId);
  if (!b) throw new Error(`no book with id ${bookId}`);
  return b.canon;
}
