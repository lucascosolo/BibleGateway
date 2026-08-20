/**
 * Decodes the morphology codes the original-language sources ship, for display.
 *
 * This lives in the app, not the corpus, and that is deliberate: `original_words.morph` stores
 * the source's own code untouched (`HR/Ncfsa`, `V- 3PAI-S--`), so a mistake in this table is a
 * one-line fix rather than a re-ingest of 443,000 words, and a researcher can always be shown
 * the raw code beside the expansion. Never "helpfully" normalise a code during ingest.
 *
 * Two encodings, because there are two sources:
 *
 *   - **OSHB (Hebrew/Aramaic).** A language letter (`H`/`A`) followed by morphemes separated by
 *     `/`, mirroring the `/` segmentation in the surface form and the lemma. `HR/Ncfsa` is a
 *     prefixed preposition plus a noun: common, feminine, singular, absolute.
 *   - **MorphGNT (Greek).** Two fixed-width fields: a two-character part of speech and an
 *     eight-character parse code, positional, with `-` for "not applicable".
 *
 * Unknown codes degrade to the raw text rather than throwing or silently dropping. A corpus
 * update that introduces a code this table has not seen should show the reader something
 * truthful, not an empty string.
 */

export interface ParsedMorphology {
  /** Human-readable expansion, e.g. "noun · common · feminine · singular · absolute". */
  label: string;
  /** Per-morpheme breakdown; Hebrew words may have several, Greek always has one. */
  segments: { code: string; parts: string[] }[];
  /** The code exactly as the source wrote it. */
  raw: string;
}

// --- Hebrew / Aramaic (OSHB) ------------------------------------------------------------

const HEB_POS: Record<string, string> = {
  A: "adjective",
  C: "conjunction",
  D: "adverb",
  N: "noun",
  P: "pronoun",
  R: "preposition",
  S: "suffix",
  T: "particle",
  V: "verb",
};

const HEB_NOUN_TYPE: Record<string, string> = { c: "common", g: "gentilic", p: "proper" };
const HEB_ADJ_TYPE: Record<string, string> = {
  a: "adjective",
  c: "cardinal number",
  g: "gentilic",
  o: "ordinal number",
};
const HEB_PRONOUN_TYPE: Record<string, string> = {
  d: "demonstrative",
  f: "indefinite",
  i: "interrogative",
  p: "personal",
  r: "relative",
};
const HEB_SUFFIX_TYPE: Record<string, string> = {
  d: "directional he",
  h: "paragogic he",
  n: "paragogic nun",
  p: "pronominal",
};
const HEB_PARTICLE_TYPE: Record<string, string> = {
  a: "affirmation",
  d: "definite article",
  e: "exhortation",
  i: "interrogative",
  j: "interjection",
  m: "demonstrative",
  n: "negative",
  o: "direct object marker",
  r: "relative",
};
const HEB_STEM: Record<string, string> = {
  q: "qal",
  N: "niphal",
  p: "piel",
  P: "pual",
  h: "hiphil",
  H: "hophal",
  t: "hithpael",
  o: "polel",
  O: "polal",
  r: "hithpolel",
  m: "poel",
  M: "poal",
  k: "palel",
  K: "pulal",
  Q: "qal passive",
  l: "pilpel",
  L: "polpal",
  f: "hithpalpel",
  D: "nithpael",
  j: "pealal",
  i: "pilel",
  u: "hothpaal",
  c: "tiphil",
  v: "hishtaphel",
  w: "nithpalel",
  y: "nithpoel",
  z: "hithpoel",
};
/**
 * Aramaic verb stems — a DIFFERENT table, not a dialect of the one above.
 *
 * This is the single most consequential entry in this file. The two tables share most of their
 * letters and almost none of their meanings: `q` is *qal* in Hebrew and *peal* in Aramaic, `p`
 * is *piel* and *pael*, `t` is *hithpael* and *hishtaphel*, `a` is not a Hebrew stem at all and
 * is *aphel* in Aramaic. Decoding an Aramaic verb through `HEB_STEM` therefore does not fail
 * loudly — it returns a real, confident, wrong grammatical label, on every verb in the Aramaic
 * portions of Daniel and Ezra. It did exactly that until an adversarial review caught it.
 *
 * Conjugation type, person, gender, number and state are genuinely shared; only the stem is not.
 * Source: OSHB parsing spec, https://hb.openscriptures.org/parsing/HebrewMorphologyCodes.html
 */
const ARC_STEM: Record<string, string> = {
  q: "peal",
  Q: "peil",
  u: "hithpeel",
  p: "pael",
  P: "ithpaal",
  M: "hithpaal",
  a: "aphel",
  h: "haphel",
  s: "saphel",
  e: "shaphel",
  H: "hophal",
  i: "ithpeel",
  t: "hishtaphel",
  v: "ishtaphel",
  w: "hithaphel",
  o: "polel",
  z: "ithpoel",
  r: "hithpolel",
  f: "hithpalpel",
  b: "hephal",
  c: "tiphel",
  m: "poel",
  l: "palpel",
  L: "ithpalpel",
  O: "ithpolel",
  G: "ittaphal",
};
const HEB_ASPECT: Record<string, string> = {
  p: "perfect",
  q: "sequential perfect",
  i: "imperfect",
  w: "sequential imperfect",
  h: "cohortative",
  j: "jussive",
  v: "imperative",
  r: "participle active",
  s: "participle passive",
  a: "infinitive absolute",
  c: "infinitive construct",
};
const HEB_PERSON: Record<string, string> = { "1": "1st person", "2": "2nd person", "3": "3rd person" };
/**
 * `b` and `c` are two different codes and were being given the same label. In OSHB `b` is
 * "both" — a noun attested in both genders — and `c` is "common", which the spec uses on verbs.
 * Collapsing them told a reader that a noun had been analysed as common gender, which is a
 * claim the source never made.
 */
const HEB_GENDER: Record<string, string> = {
  b: "both genders",
  c: "common gender",
  f: "feminine",
  m: "masculine",
};
const HEB_NUMBER: Record<string, string> = { s: "singular", p: "plural", d: "dual" };
const HEB_STATE: Record<string, string> = { a: "absolute", c: "construct", d: "determined" };

function decodeHebrewSegment(code: string, aramaic: boolean): string[] {
  if (code === "") return [];
  const pos = code[0];
  const rest = code.slice(1);
  const name = HEB_POS[pos];
  if (!name) return [code];

  const parts: string[] = [name];
  const push = (table: Record<string, string>, ch: string | undefined) => {
    if (ch === undefined) return;
    const v = table[ch];
    if (v) parts.push(v);
  };

  switch (pos) {
    case "N":
      push(HEB_NOUN_TYPE, rest[0]);
      push(HEB_GENDER, rest[1]);
      push(HEB_NUMBER, rest[2]);
      push(HEB_STATE, rest[3]);
      break;
    case "A":
      push(HEB_ADJ_TYPE, rest[0]);
      push(HEB_GENDER, rest[1]);
      push(HEB_NUMBER, rest[2]);
      push(HEB_STATE, rest[3]);
      break;
    case "P":
      push(HEB_PRONOUN_TYPE, rest[0]);
      push(HEB_PERSON, rest[1]);
      push(HEB_GENDER, rest[2]);
      push(HEB_NUMBER, rest[3]);
      break;
    case "S":
      push(HEB_SUFFIX_TYPE, rest[0]);
      push(HEB_PERSON, rest[1]);
      push(HEB_GENDER, rest[2]);
      push(HEB_NUMBER, rest[3]);
      break;
    case "T":
      push(HEB_PARTICLE_TYPE, rest[0]);
      break;
    case "V": {
      push(aramaic ? ARC_STEM : HEB_STEM, rest[0]);
      push(HEB_ASPECT, rest[1]);
      // Participles and infinitives carry gender/number/state where a finite verb carries
      // person/gender/number, so the tail is read differently depending on the aspect.
      const aspect = rest[1];
      if (aspect === "r" || aspect === "s") {
        push(HEB_GENDER, rest[2]);
        push(HEB_NUMBER, rest[3]);
        push(HEB_STATE, rest[4]);
      } else if (aspect === "a" || aspect === "c") {
        // Infinitives have no agreement to report.
      } else {
        push(HEB_PERSON, rest[2]);
        push(HEB_GENDER, rest[3]);
        push(HEB_NUMBER, rest[4]);
      }
      break;
    }
    default:
      break;
  }
  return parts;
}

// --- Greek (MorphGNT) -------------------------------------------------------------------

const GRC_POS: Record<string, string> = {
  "N-": "noun",
  "A-": "adjective",
  "RA": "article",
  "RD": "demonstrative pronoun",
  "RI": "interrogative/indefinite pronoun",
  "RP": "personal pronoun",
  "RR": "relative pronoun",
  "C-": "conjunction",
  "D-": "adverb",
  "I-": "interjection",
  "P-": "preposition",
  "X-": "particle",
  "V-": "verb",
};

const GRC_PERSON: Record<string, string> = { "1": "1st person", "2": "2nd person", "3": "3rd person" };
const GRC_TENSE: Record<string, string> = {
  P: "present",
  I: "imperfect",
  F: "future",
  A: "aorist",
  X: "perfect",
  Y: "pluperfect",
};
const GRC_VOICE: Record<string, string> = { A: "active", M: "middle", P: "passive" };
const GRC_MOOD: Record<string, string> = {
  I: "indicative",
  D: "imperative",
  S: "subjunctive",
  O: "optative",
  N: "infinitive",
  P: "participle",
};
const GRC_CASE: Record<string, string> = {
  N: "nominative",
  G: "genitive",
  D: "dative",
  A: "accusative",
  V: "vocative",
};
const GRC_NUMBER: Record<string, string> = { S: "singular", P: "plural" };
const GRC_GENDER: Record<string, string> = { M: "masculine", F: "feminine", N: "neuter" };
const GRC_DEGREE: Record<string, string> = { C: "comparative", S: "superlative" };

/** The eight parse-code positions, in order. `-` means "does not apply to this word". */
const GRC_SLOTS: Record<string, string>[] = [
  GRC_PERSON,
  GRC_TENSE,
  GRC_VOICE,
  GRC_MOOD,
  GRC_CASE,
  GRC_NUMBER,
  GRC_GENDER,
  GRC_DEGREE,
];

function decodeGreek(raw: string): ParsedMorphology {
  const [pos = "", parse = ""] = raw.split(" ");
  const parts: string[] = [];
  const posName = GRC_POS[pos];
  if (posName) parts.push(posName);

  for (let i = 0; i < GRC_SLOTS.length; i += 1) {
    const ch = parse[i];
    if (!ch || ch === "-") continue;
    const v = GRC_SLOTS[i][ch];
    if (v) parts.push(v);
  }

  if (parts.length === 0) parts.push(raw);
  return { label: parts.join(" · "), segments: [{ code: raw, parts }], raw };
}

// --- Entry point ------------------------------------------------------------------------

export function parseMorphology(raw: string, language: string): ParsedMorphology {
  if (language === "grc") return decodeGreek(raw);

  // Hebrew and Aramaic share the encoding, and the leading letter records which. That letter
  // used to be stripped and thrown away — which is how every Aramaic verb in Daniel and Ezra
  // came to be labelled with a Hebrew stem name. It is now the thing that picks the table.
  //
  // The letter wins over the `language` argument when both are present: it is written per word
  // by the source, and the OSHB marks Aramaic passages inside otherwise-Hebrew books. `language`
  // is only the fallback for a code that carries no prefix at all.
  const prefixed = /^[HA]/.test(raw);
  const aramaic = prefixed ? raw[0] === "A" : language === "arc";
  const body = prefixed ? raw.slice(1) : raw;
  const segments = body
    .split("/")
    .filter((s) => s !== "")
    .map((code) => ({ code, parts: decodeHebrewSegment(code, aramaic) }));

  if (segments.length === 0) return { label: raw, segments: [], raw };

  return {
    label: segments.map((s) => s.parts.join(" · ")).join("  +  "),
    segments,
    raw,
  };
}

/** Short form for a dense interlinear row, e.g. "n.f.s.abs" would be too cryptic; use the head. */
export function morphologyHead(raw: string, language: string): string {
  const parsed = parseMorphology(raw, language);
  return parsed.segments[parsed.segments.length - 1]?.parts[0] ?? parsed.raw;
}
