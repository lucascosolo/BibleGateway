/**
 * The biblical-vocabulary lexicon (ARCHITECTURE.md §4.6).
 *
 * Every named feature in Jot borrows real terminology from the textual
 * tradition it studies, paired with a plain-English gloss that is always
 * available — in a tooltip on desktop, as a persistent subtitle on touch,
 * and in the accessible description either way. The "Plain labels" user
 * preference swaps `term` for `plainLabel` everywhere a `<GlossLabel>` is
 * rendered; no component needs to know that toggle exists.
 */

export type LexiconId =
  | "selah"
  | "masora"
  | "pardes"
  | "toledot"
  | "qereKethiv"
  | "geniza"
  | "testimonia"
  | "massaot"
  | "lashon"
  | "derash"
  | "seder"
  | "review-draft"
  | "review-sources-located"
  | "review-claims-checked"
  | "review-expert-reviewed"
  | "investigation"
  | "difference-textual"
  | "difference-lexical"
  | "difference-grammatical"
  | "difference-stylistic"
  | "difference-interpretive"
  | "difference-editorial";

export interface LexiconEntry {
  id: LexiconId;
  /** The historical/liturgical term shown by default. */
  term: string;
  /** What the term names in plain English — shown when "Plain labels" is on. */
  plainLabel: string;
  /** The explanatory gloss: shown in tooltip / subtitle / aria-describedby. */
  gloss: string;
  /**
   * The gloss to use when "Plain labels" is on.
   *
   * Most glosses here open by translating the term — "Pause.", "Generations.", "The tongue." —
   * which is exactly right beside the Hebrew word and orphaned without it. With the preference
   * on, the Reading layers panel was titled "Reading layers" and subtitled "The four layers of
   * reading: plain, hinted, inquired, hidden", which is the gloss of a word no longer anywhere
   * on screen. A reviewer caught it.
   *
   * Optional: an entry whose gloss stands on its own needs no second version, and duplicating
   * it would just create two strings free to drift apart. Read it through `glossFor`, never
   * directly, or the preference silently stops applying wherever someone forgot.
   */
  plainGloss?: string;
}

export const lexicon: Record<LexiconId, LexiconEntry> = {
  selah: {
    id: "selah",
    term: "Selah",
    plainLabel: "Reading mode",
    gloss: "Pause. Hides everything but the text, so you can just read.",
    plainGloss: "Hides everything but the text, so you can just read.",
  },
  masora: {
    id: "masora",
    term: "Masora",
    plainLabel: "Notes",
    gloss:
      "Notes in the margin, like the ones early scribes (the Masoretes) added to protect the Hebrew text.",
  },
  pardes: {
    id: "pardes",
    term: "Pardes",
    plainLabel: "Reading layers",
    gloss: "Four ways to read, from just the text to every extra note.",
    plainGloss: "Choose what shows beside the text.",
  },
  toledot: {
    id: "toledot",
    term: "Toledot",
    plainLabel: "Timeline",
    gloss: "Generations. When things happened, and when each book was written.",
    plainGloss: "When things happened, and when each book was written.",
  },
  qereKethiv: {
    id: "qereKethiv",
    term: "Qere / Kethiv",
    plainLabel: "Variant readings",
    gloss:
      '"What is read" vs. "what is written": places where scribes noted a different wording.',
  },
  geniza: {
    id: "geniza",
    term: "Geniza",
    plainLabel: "Manuscripts",
    gloss: "A storeroom for worn-out manuscripts. Shows how the text reached us.",
    plainGloss: "How the text reached us, and the old copies it comes from.",
  },
  testimonia: {
    id: "testimonia",
    term: "Testimonia",
    plainLabel: "Cross-references",
    gloss: "Passages that point to each other.",
    plainGloss: "Passages that quote or echo each other.",
  },
  massaot: {
    id: "massaot",
    term: "Massa'ot",
    plainLabel: "Atlas",
    gloss: "Stages of a journey (see Numbers 33).",
    plainGloss: "Where things happened, and the routes between places.",
  },
  lashon: {
    id: "lashon",
    term: "Lashon",
    plainLabel: "Original language",
    gloss: "The tongue. The Hebrew, Aramaic and Greek behind the English.",
    plainGloss: "The Hebrew, Aramaic and Greek behind the English.",
  },
  derash: {
    id: "derash",
    term: "Derash",
    plainLabel: "Search",
    // Honest about the mechanism: English SQLite FTS5 with Porter stemming over the stored
    // translation text. Not a lemma/morphology index, not a semantic-domain search, and there
    // is no original-language index — "root, or meaning" promised capabilities this build does
    // not have.
    gloss: "To seek out. Searches the English text. \"Love\" also finds \"loved\". It does not search Hebrew or Greek, or look up meanings.",
    plainGloss: "Searches the English text. \"Love\" also finds \"loved\". It does not search Hebrew or Greek, or look up meanings.",
  },
  seder: {
    id: "seder",
    term: "Seder",
    plainLabel: "Reading plans",
    gloss: "Order. The cycle of readings.",
    plainGloss: "A set schedule of readings to work through.",
  },
  // Review grades for Toledot entities. The visible marker is the gloss itself, so the term and
  // the plain label are the same English words: there is no Hebrew name to translate.
  "review-draft": {
    id: "review-draft",
    term: "Draft",
    plainLabel: "Draft",
    gloss: "Draft.",
  },
  "review-sources-located": {
    id: "review-sources-located",
    term: "Sources located",
    plainLabel: "Sources located",
    gloss: "Sources located; claims not yet checked against them.",
  },
  "review-claims-checked": {
    id: "review-claims-checked",
    term: "Claims checked",
    plainLabel: "Claims checked",
    gloss: "Claims checked against the cited pages.",
  },
  "review-expert-reviewed": {
    id: "review-expert-reviewed",
    term: "Expert reviewed",
    plainLabel: "Expert reviewed",
    gloss: "Reviewed by a subject expert.",
  },
  // Investigations and the kinds of difference they explain. Plain English already, so the term
  // and the plain label are the same words; the gloss says what the word means here.
  investigation: {
    id: "investigation",
    term: "Investigation",
    plainLabel: "Investigation",
    gloss: "A close look at one passage: what each ancient copy says, which English editions follow which, and the explanations scholars give, each with its sources.",
  },
  "difference-textual": {
    id: "difference-textual",
    term: "Textual",
    plainLabel: "Textual",
    gloss: "The ancient copies themselves say different things, so editions that follow different copies print different words.",
  },
  "difference-lexical": {
    id: "difference-lexical",
    term: "Lexical",
    plainLabel: "Lexical",
    gloss: "The copies agree, but a word can mean more than one thing and translators choose differently.",
  },
  "difference-grammatical": {
    id: "difference-grammatical",
    term: "Grammatical",
    plainLabel: "Grammatical",
    gloss: "The copies agree, but the grammar allows more than one way to construe the sentence.",
  },
  "difference-stylistic": {
    id: "difference-stylistic",
    term: "Stylistic",
    plainLabel: "Stylistic",
    gloss: "A choice of English style; the meaning is the same.",
  },
  "difference-interpretive": {
    id: "difference-interpretive",
    term: "Interpretive",
    plainLabel: "Interpretive",
    gloss: "The words are agreed; readers disagree about what the passage means by them.",
  },
  "difference-editorial": {
    id: "difference-editorial",
    term: "Editorial",
    plainLabel: "Editorial",
    gloss: "An editor's decision, such as punctuation, verse division or which reading to print in the main text.",
  },
};

export function getLexiconEntry(id: LexiconId): LexiconEntry {
  return lexicon[id];
}

/**
 * The gloss to show, given the "Plain labels" preference.
 *
 * The single accessor for it. Reading `entry.gloss` directly is how the preference stops
 * applying in one place and nobody notices — which is exactly what happened in the Reading
 * layers panel, where the Hebrew term was correctly swapped out of the title and its
 * translation was left standing underneath.
 */
export function glossFor(entry: LexiconEntry, plainLabels: boolean): string {
  return plainLabels ? (entry.plainGloss ?? entry.gloss) : entry.gloss;
}
