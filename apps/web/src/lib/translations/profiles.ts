/**
 * Who made each edition in the corpus, from what, and how — and which editions are not
 * independent of each other. Data only; the pages under /translations render it.
 *
 * Citation rules: a page in a filed source (docs/sources/<id>.md) wherever one exists; otherwise
 * the edition's own front matter or publisher page, with `publisherOnly: true` so the page can say
 * plainly that nobody else vouches for it. A claim about wording ("uses Jehovah") cites the
 * edition's own text on this site, which anyone can open and check.
 */

export type ProfileStatus = "sources-located" | "claims-checked";
export type Approach = "formal" | "functional" | "balanced" | "original";
export type FamilyId =
  | "tyndale-kjv"
  | "rv-asv-web"
  | "single-translator"
  | "berean"
  | "jewish"
  | "septuagint"
  | "original-text";

export interface Citation {
  source: string;
  locator: string;
  url?: string;
  publisherOnly: boolean;
}
export interface Claim {
  text: string;
  citations: Citation[];
}
export interface TranslationProfile {
  code: string;
  kind: "translation" | "original";
  name: string;
  year: string;
  lineage: Claim;
  otSource: string | null;
  ntSource: string | null;
  sourcePolicy: Claim;
  approach: Approach;
  philosophy: Claim;
  conventions: Claim[];
  family: FamilyId;
  notIndependentOf: string[];
  readWhen: string;
  status: ProfileStatus;
}

export const FAMILIES: Record<FamilyId, { label: string; description: string }> = {
  "tyndale-kjv": {
    label: "Tyndale–King James line",
    description: "The 1611 Authorized Version, the parent of the other English line here.",
  },
  "rv-asv-web": {
    label: "Revised Version line",
    description:
      "The 1881–1885 revision of the King James Bible against older manuscripts, its 1901 American edition, and the modern public-domain revision of that.",
  },
  "single-translator": {
    label: "Single-translator work",
    description:
      "A nineteenth-century translation made by one scholar from the original languages. Two works in this group are not related to each other merely by being in it.",
  },
  berean: {
    label: "Berean project",
    description: "A twenty-first-century translation made by a committee, released into the public domain.",
  },
  jewish: {
    label: "Jewish translation",
    description: "A translation of the Hebrew Bible made for Jewish readers; it has no New Testament.",
  },
  septuagint: {
    label: "Septuagint translation",
    description:
      "An English translation of the ancient Greek translation of the Hebrew scriptures, not of the Hebrew itself.",
  },
  "original-text": {
    label: "Original-language edition",
    description: "A modern scholarly edition of the Hebrew or Greek text. Not a translation.",
  },
};

const HG = "Hixson and Gurry (eds.), Myths and Mistakes in New Testament Textual Criticism (2019)";
const METZGER = "Metzger, A Textual Commentary on the Greek New Testament, 2nd ed. (1994)";
const TOV = "Tov, Textual Criticism of the Hebrew Bible, 3rd ed. (2012)";
const TEXT = "This edition's own text on this site";

const cite = (source: string, locator: string, url?: string): Citation => ({ source, locator, url, publisherOnly: false });
const publisher = (source: string, locator: string, url: string): Citation => ({ source, locator, url, publisherOnly: true });

const FORM_BASED = cite(HG, "p. 306 (Ebojo: form-based and meaning-based translation)");
const KJV_TR = cite(METZGER, "pp. 8*–10* (Erasmus, Beza and the Textus Receptus)");
const KJV_TR_HG = cite(HG, "p. 114 (Lanier: the Textus Receptus largely underlies the KJV)");
const RV_WH = cite(METZGER, "pp. 14*–16* (the Revised Version of 1881 and Westcott and Hort's Greek text)");
const ASV_TITLE = publisher("American Standard Version (1901), title page", "front matter", "https://ebible.org/asv/FRT01.htm");
const WEB_SITE = publisher("World English Bible, publisher's statement", "home page", "https://worldenglish.bible/");
const BEREAN = publisher("Berean Bible, publisher's statement", "home page", "https://berean.bible/");
const BEREAN_SOURCES = publisher(
  "Berean Bible, Greek and Hebrew sources",
  "source list",
  "https://bereanbibles.com/about-berean-study-bible/greek-and-hebrew-sources/",
);
const BEREAN_TERMS = publisher("Berean Bible, terms of use", "public-domain dedication", "https://berean.bible/terms.htm");
const DEUT_6_4 = (code: string) => cite(TEXT, `Deuteronomy 6:4 (/read/Deut.6.4?t=${code})`);
const JOHN_3_16 = (code: string) => cite(TEXT, `John 3:16 (/read/John.3.16?t=${code})`);

/** The verse each translation profile shows: the one verse every edition here, Brenton included, prints. */
export const SAMPLE_VERSE_LABEL = "Deuteronomy 6:4";

export const PROFILES: readonly TranslationProfile[] = [
  {
    code: "WEB",
    kind: "translation",
    name: "World English Bible",
    year: "Modern; text now stable",
    lineage: {
      text: "A modern-English, public-domain revision of the American Standard Version of 1901.",
      citations: [WEB_SITE],
    },
    otSource: "Masoretic Text (Biblia Hebraica Stuttgartensia)",
    ntSource: "ASV choices combined with the Majority Text",
    sourcePolicy: {
      text: "The publisher names the Biblia Hebraica Stuttgartensia for the Old Testament and, for the New, a combination of the ASV's own textual choices with the Greek Majority Text. In practice it leaves out the verses the ASV leaves out, such as Acts 8:37.",
      citations: [WEB_SITE, cite(TEXT, "Acts 8:37 (/read/Acts.8.37?t=WEB)")],
    },
    approach: "formal",
    philosophy: {
      text: "It keeps the ASV's close, form-based rendering while replacing archaic English. The form-based classification is this site's, using the distinction scholars of translation draw.",
      citations: [WEB_SITE, FORM_BASED],
    },
    conventions: [
      {
        text: "Prints the divine name as “Yahweh” where most English Bibles print “the LORD”.",
        citations: [WEB_SITE, DEUT_6_4("WEB")],
      },
      { text: "Modern pronouns: “you”, not “thee” and “thou”.", citations: [JOHN_3_16("WEB")] },
    ],
    family: "rv-asv-web",
    notIndependentOf: ["ASV", "KJV"],
    readWhen: "Read it when you want the ASV's closeness to the text in plain modern English, with the divine name spelled out.",
    status: "claims-checked",
  },
  {
    code: "BSB",
    kind: "translation",
    name: "Berean Standard Bible",
    year: "2016–2022",
    lineage: {
      text: "A new translation, not a revision of an earlier English Bible (“a completely new English translation”, in the publisher's words), dedicated to the public domain on 30 April 2023.",
      citations: [BEREAN, BEREAN_TERMS],
    },
    otSource: "Masoretic Text (Westminster Leningrad Codex, BHS)",
    ntSource: "Modern critical Greek text",
    sourcePolicy: {
      text: "The publisher lists the Westminster Leningrad Codex and the Biblia Hebraica Stuttgartensia, and notes the critical, Byzantine and Textus Receptus Greek editions in its footnotes. Its main New Testament text follows the critical editions: it does not print the twelve verses the oldest copies lack.",
      citations: [BEREAN_SOURCES, cite(TEXT, "Acts 8:37 (/read/Acts.8.37?t=BSB)")],
    },
    approach: "balanced",
    philosophy: {
      text: "The publisher describes a text in which every word is tied back to the Hebrew or Greek; the English reads more freely than the strictly form-based editions here. The balanced classification is this site's.",
      citations: [BEREAN, FORM_BASED],
    },
    conventions: [
      { text: "Prints “the LORD” for the divine name.", citations: [DEUT_6_4("BSB")] },
      { text: "Capitalises pronouns that refer to God: “He”, “His”.", citations: [JOHN_3_16("BSB")] },
    ],
    family: "berean",
    notIndependentOf: [],
    readWhen: "Read it when you want a current, readable translation from the modern critical texts.",
    status: "sources-located",
  },
  {
    code: "KJV",
    kind: "translation",
    name: "King James Version",
    year: "1611; standard text 1769",
    lineage: {
      text: "The Authorized Version of 1611. The text printed today, and here, is the standardised edition of 1769.",
      citations: [cite(METZGER, "p. xiii (AV = Authorized or King James Version, 1611)"), publisher("King James Version, eBible.org distribution notice", "copyright page", "https://ebible.org/kjv/")],
    },
    otSource: "Masoretic Text",
    ntSource: "Textus Receptus",
    sourcePolicy: {
      text: "The New Testament follows the printed Greek text of the sixteenth century later called the Textus Receptus, in the editions of Erasmus and Beza, which rest on a handful of late manuscripts. The Old Testament renders the Masoretic Hebrew.",
      citations: [KJV_TR, KJV_TR_HG, cite(TOV, "p. 3 (Gen 49:10: the KJV renders the Masoretic reading)")],
    },
    approach: "formal",
    philosophy: {
      text: "Close to the form of the source, in the formal English of its own day. The form-based classification is this site's.",
      citations: [FORM_BASED],
    },
    conventions: [
      { text: "Prints “the LORD” for the divine name.", citations: [DEUT_6_4("KJV")] },
      { text: "Archaic pronouns and verb endings: “thee”, “thou”, “believeth”.", citations: [JOHN_3_16("KJV")] },
      {
        text: "Prints verses that most modern Bibles leave out, such as Acts 8:37 and 1 John 5:7–8 in its longer form.",
        citations: [cite(METZGER, "pp. 647–649 (1 John 5:7–8)"), cite(HG, "p. 207"), cite(TEXT, "Acts 8:37 (/read/Acts.8.37?t=KJV)")],
      },
    ],
    family: "tyndale-kjv",
    notIndependentOf: ["ASV", "WEB"],
    readWhen: "Read it when you need the wording that shaped English literature and liturgy, or the Textus Receptus behind it.",
    status: "claims-checked",
  },
  {
    code: "ASV",
    kind: "translation",
    name: "American Standard Version",
    year: "1901",
    lineage: {
      text: "The American edition of the Revised Version (New Testament 1881, Old Testament 1885), which revised the King James Bible against older manuscripts.",
      citations: [ASV_TITLE, cite(METZGER, "p. xiii (ASV = American Standard Version, 1901)")],
    },
    otSource: "Masoretic Text",
    ntSource: "Critical text of the 1880s (close to Westcott and Hort)",
    sourcePolicy: {
      text: "The Revised Version's New Testament was translated largely from Westcott and Hort's Greek text rather than the Textus Receptus, so the ASV leaves out verses the King James prints, such as Acts 8:37.",
      citations: [RV_WH, cite(TEXT, "Acts 8:37 (/read/Acts.8.37?t=ASV)")],
    },
    approach: "formal",
    philosophy: {
      text: "A revision “compared with the most ancient authorities”, close to the form of the original. The form-based classification is this site's.",
      citations: [ASV_TITLE, FORM_BASED],
    },
    conventions: [
      { text: "Prints “Jehovah” for the divine name.", citations: [DEUT_6_4("ASV")] },
      { text: "Keeps the King James pronouns: “thee”, “thou”, “believeth”.", citations: [JOHN_3_16("ASV")] },
    ],
    family: "rv-asv-web",
    notIndependentOf: ["KJV", "WEB"],
    readWhen: "Read it when you want to see what the first critical-text revision of the King James changed.",
    status: "claims-checked",
  },
  {
    code: "DBY",
    kind: "translation",
    name: "Darby Translation",
    year: "19th century (NT 1867, OT 1890)",
    lineage: {
      text: "“A new translation from the original languages” by John Nelson Darby; not a revision of an earlier English Bible.",
      citations: [publisher("Darby Translation, eBible.org distribution notice", "copyright page", "https://ebible.org/engDBY/")],
    },
    otSource: "Masoretic Text",
    ntSource: "Greek (edition not yet documented here)",
    sourcePolicy: {
      text: "Translated from the Hebrew and Greek. Which Greek edition Darby followed is not yet documented here; in this corpus he prints Acts 24:7 but not Acts 8:37, so he follows neither the King James nor the modern critical text throughout.",
      citations: [cite(TEXT, "Acts 8:37 and 24:7 (/read/Acts.24.7?t=DBY)")],
    },
    approach: "formal",
    philosophy: {
      text: "Close to the form of the source, often at the cost of smooth English. The form-based classification is this site's.",
      citations: [FORM_BASED],
    },
    conventions: [
      { text: "Prints “Jehovah” for the divine name, and sometimes leaves “Elohim” untranslated.", citations: [DEUT_6_4("DBY"), cite(TEXT, "Genesis 2:4 (/read/Gen.2.4?t=DBY)")] },
    ],
    family: "single-translator",
    notIndependentOf: [],
    readWhen: "Read it beside the King James to see a nineteenth-century scholar's independent close rendering.",
    status: "sources-located",
  },
  {
    code: "YLT",
    kind: "translation",
    name: "Young's Literal Translation",
    year: "1862; revised 1887 and 1898",
    lineage: {
      text: "A translation by Robert Young; not a revision of an earlier English Bible.",
      citations: [publisher("Young's Literal Translation, eBible.org distribution notice", "copyright page", "https://ebible.org/engylt/")],
    },
    otSource: "Masoretic Text",
    ntSource: "Textus Receptus",
    sourcePolicy: {
      text: "His New Testament follows the received Greek text: it prints the verses the King James prints, such as Acts 8:37.",
      citations: [cite(TEXT, "Acts 8:37 (/read/Acts.8.37?t=YLT)")],
    },
    approach: "formal",
    philosophy: {
      text: "The most literal edition here: it keeps Hebrew and Greek word order and tense forms even where English strains.",
      citations: [FORM_BASED, cite(TEXT, "Genesis 1:1 (/read/Gen.1.1?t=YLT)")],
    },
    conventions: [
      { text: "Prints “Jehovah” for the divine name.", citations: [DEUT_6_4("YLT")] },
      { text: "Marks words the translator supplied with square brackets: “[is] one Jehovah”.", citations: [DEUT_6_4("YLT")] },
    ],
    family: "single-translator",
    notIndependentOf: [],
    readWhen: "Read it when you want to see the shape of the Hebrew or Greek sentence through the English.",
    status: "sources-located",
  },
  {
    code: "JPS",
    kind: "translation",
    name: "JPS TaNaKH",
    year: "1917",
    lineage: {
      text: "Published by the Jewish Publication Society in 1917. The later “new JPS” translation is a different text and is not this one.",
      citations: [publisher("JPS TaNaKH (1917), eBible.org distribution notice", "copyright page", "https://ebible.org/engjps/")],
    },
    otSource: "Masoretic Text",
    ntSource: null,
    sourcePolicy: {
      text: "A Jewish translation of the Hebrew Bible, so it has no New Testament.",
      citations: [publisher("JPS TaNaKH (1917), eBible.org distribution notice", "copyright page", "https://ebible.org/engjps/")],
    },
    approach: "formal",
    philosophy: {
      text: "Close to the form of the Hebrew, in formal English with “thee” and “thou”. The form-based classification is this site's.",
      citations: [FORM_BASED],
    },
    conventions: [
      { text: "Prints “the LORD” for the divine name.", citations: [DEUT_6_4("JPS")] },
      { text: "Where Hebrew verse numbers differ from English ones, this site follows the English numbering.", citations: [cite(TEXT, "Psalm 51 (/read/Ps.51?t=JPS)")] },
    ],
    family: "jewish",
    notIndependentOf: [],
    readWhen: "Read it when you want the Hebrew Bible as a Jewish translation of 1917 rendered it.",
    status: "sources-located",
  },
  {
    code: "LXX",
    kind: "translation",
    name: "Brenton's Septuagint",
    year: "1851",
    lineage: {
      text: "Sir Lancelot Brenton's English translation of the Septuagint, the ancient Greek translation of the Hebrew scriptures. This site includes five books whose verse numbering has been checked.",
      citations: [publisher("Brenton Septuagint, eBible.org distribution notice", "copyright page", "https://ebible.org/eng-Brenton/")],
    },
    otSource: "Septuagint (Greek)",
    ntSource: null,
    sourcePolicy: {
      text: "Translates the Greek, not the Hebrew. The Septuagint was made from Hebrew texts that sometimes differ from the Masoretic Text, so where it disagrees with the other editions here it can be a witness to a different Hebrew original, not only a different translation.",
      citations: [cite(TOV, "p. 287 (Septuagint Jeremiah translated from a Hebrew text close to two Qumran copies)")],
    },
    approach: "formal",
    philosophy: {
      text: "Close to the form of the Greek. The form-based classification is this site's.",
      citations: [FORM_BASED],
    },
    conventions: [
      { text: "Prints “the Lord”, following the Greek κύριος.", citations: [DEUT_6_4("LXX")] },
      { text: "Numbers some chapters differently from the Hebrew; affected verses are mapped or marked.", citations: [cite(TEXT, "Deuteronomy 13 (/read/Deut.13?t=LXX)")] },
    ],
    family: "septuagint",
    notIndependentOf: [],
    readWhen: "Read it when you want to know how the ancient Greek translation read a passage.",
    status: "claims-checked",
  },
  {
    code: "WLC",
    kind: "original",
    name: "Westminster Leningrad Codex",
    year: "Medieval codex; modern digital edition",
    lineage: {
      text: "A digital transcription of the Leningrad Codex (B19A), the manuscript that also underlies the standard printed editions BH, BHS and BHQ.",
      citations: [cite(TOV, "p. 7 (codex Leningrad B19A and its editions)")],
    },
    otSource: "Masoretic Text (Leningrad Codex)",
    ntSource: null,
    sourcePolicy: {
      text: "One manuscript of the Masoretic Text, transcribed as written.",
      citations: [cite(TOV, "p. 7")],
    },
    approach: "original",
    philosophy: {
      text: "Not a translation. The words shown in the original-language layer and the interlinear come from here.",
      citations: [cite(TOV, "p. 7")],
    },
    conventions: [],
    family: "original-text",
    notIndependentOf: [],
    readWhen: "Read it when you want the Hebrew behind every Old Testament edition here except Brenton.",
    status: "claims-checked",
  },
  {
    code: "SBLGNT",
    kind: "original",
    name: "SBL Greek New Testament",
    year: "2010",
    lineage: {
      text: "Michael Holmes's critical edition of the Greek New Testament, published by the Society of Biblical Literature. Its apparatus compares four other major editions.",
      citations: [cite(HG, "p. 308 (Holmes, SBL Greek New Testament)")],
    },
    otSource: null,
    ntSource: "Critical text (Holmes 2010)",
    sourcePolicy: {
      text: "An eclectic critical text: each reading chosen from across the manuscripts, like the Nestle-Aland text most modern translations use.",
      citations: [cite(HG, "pp. 308–309")],
    },
    approach: "original",
    philosophy: {
      text: "Not a translation. The Greek words in the original-language layer and the investigations come from here.",
      citations: [cite(HG, "p. 308")],
    },
    conventions: [],
    family: "original-text",
    notIndependentOf: [],
    readWhen: "Read it when you want the Greek a modern critical translation is made from.",
    status: "claims-checked",
  },
];

export function getProfile(code: string): TranslationProfile | undefined {
  const key = code.toUpperCase();
  return PROFILES.find((p) => p.code === key);
}

export function profileCitations(p: TranslationProfile): Citation[] {
  return [p.lineage, p.sourcePolicy, p.philosophy, ...p.conventions].flatMap((c) => c.citations);
}

export function dependentPairs(codes: readonly string[]): [string, string][] {
  const pairs: [string, string][] = [];
  codes.forEach((a, i) => {
    for (const b of codes.slice(i + 1)) {
      const pa = getProfile(a);
      const pb = getProfile(b);
      if (pa && pb && (pa.notIndependentOf.includes(pb.code) || pb.notIndependentOf.includes(pa.code))) {
        pairs.push([pa.code, pb.code]);
      }
    }
  });
  return pairs;
}
