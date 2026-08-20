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
  | "seder";

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
    gloss: "Pause. Hides every layer for uninterrupted reading.",
    plainGloss: "Hides every layer for uninterrupted reading.",
  },
  masora: {
    id: "masora",
    term: "Masora",
    plainLabel: "Notes",
    gloss:
      "Notes in the margin — after the Masoretes, who annotated the Hebrew text to preserve it.",
  },
  pardes: {
    id: "pardes",
    term: "Pardes",
    plainLabel: "Reading layers",
    gloss: "The four layers of reading: plain, hinted, inquired, hidden.",
    plainGloss: "What to show alongside the text, and what to leave out.",
  },
  toledot: {
    id: "toledot",
    term: "Toledot",
    plainLabel: "Timeline",
    gloss: "Generations. When each book was written, and when its events happened.",
    plainGloss: "When each book was written, and when its events happened.",
  },
  qereKethiv: {
    id: "qereKethiv",
    term: "Qere / Kethiv",
    plainLabel: "Variant readings",
    gloss:
      '"What is read" vs. "what is written" — the scribes\' own variant notes.',
  },
  geniza: {
    id: "geniza",
    term: "Geniza",
    plainLabel: "Manuscripts",
    gloss: "The storeroom of worn manuscripts. How the text reached us.",
    plainGloss: "How the text reached us: the copies it survived in.",
  },
  testimonia: {
    id: "testimonia",
    term: "Testimonia",
    plainLabel: "Cross-references",
    gloss: "Chains of linked passages that testify to one another.",
    plainGloss: "Passages that quote, echo or answer one another.",
  },
  massaot: {
    id: "massaot",
    term: "Massa'ot",
    plainLabel: "Atlas",
    gloss: "Stages of the journey (Numbers 33).",
    plainGloss: "Where events happened, and the routes between them.",
  },
  lashon: {
    id: "lashon",
    term: "Lashon",
    plainLabel: "Original language",
    gloss: "The tongue. Hebrew, Aramaic and Greek beneath the translation.",
    plainGloss: "Hebrew, Aramaic and Greek beneath the translation.",
  },
  derash: {
    id: "derash",
    term: "Derash",
    plainLabel: "Search",
    // Honest about the mechanism: English SQLite FTS5 with Porter stemming over the stored
    // translation text. Not a lemma/morphology index, not a semantic-domain search, and there
    // is no original-language index — "root, or meaning" promised capabilities this build does
    // not have.
    gloss: "To seek out. English word search (stemmed, e.g. \"love\" also finds \"loved\") — not original-language or semantic search.",
    plainGloss: "English word search (stemmed, e.g. \"love\" also finds \"loved\") — not original-language or semantic search.",
  },
  seder: {
    id: "seder",
    term: "Seder",
    plainLabel: "Reading plans",
    gloss: "Order. The cycle of readings.",
    plainGloss: "A cycle of readings to work through.",
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
