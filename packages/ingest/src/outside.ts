// Placement of the outside books' source units onto their addresses. The tables and the
// address scheme are documented in outside-maps.ts; the book ids in translations.ts.
import { OUTSIDE_BOOKS } from "./translations.js";
import { BRENTON_PLACEMENTS, KJVA_PLACEMENTS, KJVA_UNPLACED } from "./outside-maps.js";
import type { Footnote } from "./footnotes.js";

export type OutsideEdition = "LXX" | "KJVA";

export interface OutsideUnit {
  usfm: string;
  chapter: number;
  /** 0 for unversed text before verse 1 (a prologue). */
  verse: number;
  /** Lettered subverse suffix as the source prints it, "" for none. */
  part: string;
  text: string;
  footnotes: Footnote[];
}

export interface Address {
  osis: string;
  chapter: number;
  verse: number;
}

/** USFM source books whose integer labels are the address (identity), by edition. */
const IDENTITY: Record<OutsideEdition, Readonly<Record<string, string>>> = {
  LXX: {
    TOB: "Tob", JDT: "Jdt", WIS: "Wis", SIR: "Sir", BAR: "Bar", LJE: "EpJer", SUS: "Sus", BEL: "Bel",
    "1MA": "1Macc", "2MA": "2Macc", "3MA": "3Macc", "4MA": "4Macc", "1ES": "1Esd", MAN: "PrMan",
  },
  KJVA: {
    TOB: "Tob", JDT: "Jdt", WIS: "Wis", SIR: "Sir", BAR: "Bar", SUS: "Sus", BEL: "Bel",
    "1MA": "1Macc", "2MA": "2Macc", "1ES": "1Esd", MAN: "PrMan", "2ES": "2Esd", S3Y: "PrAzar",
    ESG: "AddEsth",
  },
};

/** Source books that hold outside-book text, so the parser can hand them over unmerged. */
export const OUTSIDE_SOURCE_CODES: ReadonlySet<string> = new Set([
  ...Object.keys(IDENTITY.LXX),
  ...Object.keys(IDENTITY.KJVA),
  "ESG",
  "DAG",
]);

const key = (...parts: (string | number)[]) => parts.join(".");
const brenton = new Map(BRENTON_PLACEMENTS.map(([b, c, v, p, osis, tc, tv]) => [key(b, c, v, p), { osis, chapter: tc, verse: tv }]));
const kjva = new Map(KJVA_PLACEMENTS.map(([b, c, v, osis, tc, tv]) => [key(b, c, v), { osis, chapter: tc, verse: tv }]));
const kjvaUnplaced = new Set(KJVA_UNPLACED.map(([b, c, v]) => key(b, c, v)));

/**
 * Where a source unit lives. "excluded" is text that is not an outside book's (a canonical
 * verse of Greek Esther or Daniel, a protocanonical book); "unplaced" is reviewed outside text
 * with no address. Anything else that cannot be placed throws.
 */
export function placeOutsideUnit(edition: OutsideEdition, u: Pick<OutsideUnit, "usfm" | "chapter" | "verse" | "part">): Address | "excluded" | "unplaced" {
  if (edition === "LXX") {
    const explicit = brenton.get(key(u.usfm, u.chapter, u.verse, u.part));
    if (explicit) return explicit;
    if (u.usfm === "PSA") return u.chapter === 151 ? { osis: "Ps151", chapter: 1, verse: u.verse } : "excluded";
    if (u.usfm === "ESG" || u.usfm === "DAG") {
      // Brenton letters the opening of canonical Esther 1:1 as 1:1s, after Addition A.
      if (u.usfm === "ESG" && u.chapter === 1 && u.verse === 1 && u.part === "s") return "excluded";
      if (u.part !== "" || (u.usfm === "DAG" && u.chapter === 3 && u.verse >= 24 && u.verse <= 90)) {
        throw new Error(`[outside] Brenton ${u.usfm} ${u.chapter}:${u.verse}${u.part} is an addition with no reviewed placement`);
      }
      return "excluded";
    }
  } else {
    if (kjvaUnplaced.has(key(u.usfm, u.chapter, u.verse))) return "unplaced";
    const explicit = kjva.get(key(u.usfm, u.chapter, u.verse));
    if (explicit) return explicit;
    if (u.usfm === "BAR" && u.chapter === 6) return { osis: "EpJer", chapter: 1, verse: u.verse };
  }
  const osis = IDENTITY[edition][u.usfm];
  if (!osis) return "excluded";
  if (u.verse === 0) {
    if (osis !== "Sir" || u.chapter !== 1) throw new Error(`[outside] ${edition} ${u.usfm} ${u.chapter}: unversed text where no prologue is expected`);
    return { osis, chapter: 1, verse: 0 };
  }
  return { osis, chapter: u.chapter, verse: u.verse };
}

export interface PlacedVerse extends Address {
  bookId: number;
  text: string;
  footnotes: Footnote[];
  sources: { usfm: string; chapter: number; verse: number; part: string }[];
}

/**
 * Places every unit of one edition. Units that share an address (Brenton's lettered pieces of
 * one KJV verse, the eight units of the Sirach prologue) are joined in source order.
 */
export function placeEdition(edition: OutsideEdition, units: readonly OutsideUnit[]): { placed: PlacedVerse[]; unplaced: number } {
  const bookIdByOsis = new Map(OUTSIDE_BOOKS.map((b) => [b.osisId, b.bookId]));
  const byAddress = new Map<string, PlacedVerse>();
  let unplaced = 0;
  for (const u of units) {
    const to = placeOutsideUnit(edition, u);
    if (to === "excluded") continue;
    if (to === "unplaced") {
      unplaced++;
      continue;
    }
    const bookId = bookIdByOsis.get(to.osis);
    if (bookId === undefined) throw new Error(`[outside] no book id for ${to.osis}`);
    const k = key(to.osis, to.chapter, to.verse);
    const source = { usfm: u.usfm, chapter: u.chapter, verse: u.verse, part: u.part };
    const prior = byAddress.get(k);
    if (prior) {
      prior.text = `${prior.text} ${u.text}`;
      prior.footnotes.push(...u.footnotes);
      prior.sources.push(source);
    } else {
      byAddress.set(k, { ...to, bookId, text: u.text, footnotes: [...u.footnotes], sources: [source] });
    }
  }
  return { placed: [...byAddress.values()], unplaced };
}
