/**
 * The outside books (Chitzonim): books 67 and up, addressed by the same verse_id and printed by
 * the same renderer as the 66. This module is the plain data and wording the workspace and the
 * reader share; it reads nothing from the database.
 */

export type OutsideArea = "deuterocanon" | "pseudepigrapha" | "nt-apocrypha" | "apostolic" | "described";

export interface AreaInfo {
  key: OutsideArea;
  title: string;
  summary: string;
  /** Who reads these as scripture, in one sentence. Shown on the threshold, never as a verdict. */
  readBy: string;
}

export const OUTSIDE_AREAS: readonly AreaInfo[] = [
  {
    key: "deuterocanon",
    title: "The Septuagint's extra books",
    summary:
      "Jewish writings from the last centuries BCE that travelled with the Greek Old Testament but not with the Hebrew Bible: Tobit, Judith, Wisdom, Sirach, the Maccabees and others.",
    readBy:
      "Catholic and Orthodox Bibles include most of them, though which ones varies by church; older Protestant Bibles printed them between the Testaments as the Apocrypha.",
  },
  {
    key: "pseudepigrapha",
    title: "Second Temple writings",
    summary:
      "Jewish works written in the name of ancient figures (Enoch, the twelve sons of Jacob, Baruch), widely read in the centuries around Jesus and quoted in the New Testament itself.",
    readBy: "The Ethiopian Orthodox Tewahedo Church reads 1 Enoch and Jubilees as scripture; no other church does.",
  },
  {
    key: "nt-apocrypha",
    title: "New Testament apocrypha",
    summary:
      "Gospels, acts and apocalypses about Jesus and the apostles that did not enter the New Testament, from the sayings of Thomas to the childhood stories of the Protevangelium.",
    readBy: "No church's New Testament includes them today, though several shaped liturgy, feast days and art.",
  },
  {
    key: "apostolic",
    title: "The Apostolic Fathers",
    summary:
      "The earliest Christian writings after the New Testament: the Didache, 1 Clement, the letters of Ignatius, Barnabas and the Shepherd of Hermas.",
    readBy:
      "Some were read aloud in churches in the first centuries, and three are bound into great Bible codices, but none is in any New Testament today.",
  },
  {
    key: "described",
    title: "Qumran and Nag Hammadi",
    summary:
      "Works with no free complete translation, described rather than printed: what each is, where it was found, how it is dated, and short cited excerpts.",
    readBy: "None is scripture in any living tradition; they are witnesses to the communities that copied them.",
  },
];

export function getArea(key: string): AreaInfo | undefined {
  return OUTSIDE_AREAS.find((a) => a.key === key);
}

import { formatRange } from "@/lib/timeline/years";

export const FIRST_OUTSIDE_BOOK = 67;

export function isOutsideBook(bookId: number): boolean {
  return bookId >= FIRST_OUTSIDE_BOOK;
}

const FALLBACK_NOTICE: Record<string, string> = {
  deuterocanon:
    "Outside the Hebrew and Protestant canons: read in Catholic and Orthodox Bibles, which differ on exactly which of these books they include.",
  pseudepigrapha: "Outside the canon: not in Jewish, Catholic or Protestant Bibles.",
  "nt-apocrypha": "Outside the canon: not in any church's New Testament today.",
  apostolic: "Outside the canon: read in some churches in the first centuries; not in any New Testament today.",
};

const NOT_IN = ["Jewish", "Catholic", "Protestant"] as const;

function joinList(items: readonly string[], conjunction: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

/**
 * The reader's one-line canon notice. From the work record's holders when there are any, so it
 * names who actually reads the book; otherwise a sentence true of every book in that canon.
 */
export function canonNotice(canon: string | undefined, holders: readonly string[]): string | null {
  if (!canon || canon === "hebrew" || canon === "nt") return null;
  if (holders.length === 0) return FALLBACK_NOTICE[canon] ?? "Outside the canon.";
  const lower = holders.map((h) => h.toLowerCase());
  const absent = NOT_IN.filter((name) => !lower.some((h) => h.includes(name.toLowerCase())));
  const notIn = absent.length ? `; not in ${joinList(absent, "or")} Bibles` : "";
  const named = holders.map((h) => (/^the /i.test(h) ? h : `the ${h}`));
  return `Outside the canon: read in ${joinList(named, "and")}${notIn}.`;
}

const BANDS: Record<string, { names: readonly string[]; chaptered: boolean }> = {
  Herm: { names: ["Vision", "Mandate", "Parable"], chaptered: false },
  InfThom: { names: ["Greek A", "Greek B", "Latin"], chaptered: true },
};

/** How a book's own numbering names one address: "logion 42", "chapter 3", "page 33". */
export function numberingLabel(numbering: string | undefined, osisId: string, chapter: number, verse: number): string {
  switch (numbering) {
    case "logion":
      return verse === 0 ? "prologue" : `logion ${verse}`;
    case "section":
      return `section ${verse}`;
    case "chapter":
      return `chapter ${chapter}`;
    case "paragraph":
      return `chapter ${chapter}, paragraph ${verse}`;
    case "page":
      return `page ${chapter}`;
    case "part-chapter": {
      const part = Math.floor(chapter / 100);
      const within = chapter % 100;
      const band = BANDS[osisId];
      const name = band?.names[part] ?? `part ${part + 1}`;
      return band && !band.chaptered ? `${name} ${within}` : `${name}, chapter ${within}`;
    }
    default:
      return verse === 0 ? "prologue" : `chapter ${chapter}`;
  }
}

export function numberingRangeLabel(
  numbering: string | undefined,
  osisId: string,
  start: { chapter: number; verse: number },
  end: { chapter: number; verse: number },
): string {
  const a = numberingLabel(numbering, osisId, start.chapter, start.verse);
  const b = numberingLabel(numbering, osisId, end.chapter, end.verse);
  return a === b ? a : `${a} to ${b}`;
}

/** The translations that print a book, in the corpus's own order. */
export function carryingTranslations<T extends { code: string }>(all: readonly T[], carriers: Iterable<string>): T[] {
  const codes = new Set([...carriers].map((c) => c.toUpperCase()));
  return all.filter((t) => codes.has(t.code.toUpperCase()));
}

/**
 * The edition the reader should show for an outside book: the requested one when it carries the
 * book, otherwise the first that does. Null when no edition carries it.
 */
export function translationForOutsideBook(requested: string | undefined, carriers: readonly string[]): string | null {
  if (requested && carriers.some((c) => c.toUpperCase() === requested.toUpperCase())) return requested;
  return carriers[0] ?? null;
}

/**
 * The two editions /parallel opens with, drawn only from `carrying`. An explicit code that does
 * not carry the book is ignored; `right` is undefined when only one edition carries it. An
 * explicit identical pair is returned as asked so the page can ask for two different ones.
 */
export function parallelPair<T extends { code: string }>(
  carrying: readonly T[],
  a?: string,
  b?: string,
): { left: T | undefined; right: T | undefined } {
  const find = (code?: string) => carrying.find((t) => t.code.toUpperCase() === code?.toUpperCase());
  const left = find(a) ?? find("WEB") ?? carrying[0];
  const right = find(b) ?? [find(left?.code === "BSB" ? "WEB" : "BSB"), ...carrying].find((t) => t && t !== left);
  return { left, right };
}

/**
 * How a work's dating reads. A one-year span prints the leading position's own label ("About 170
 * CE"), because a bare year drops the word the source used; a real span prints as a range.
 */
export function composedLabel(earliest: number, latest: number, leadingLabel: string | null | undefined): string {
  return earliest === latest && leadingLabel ? leadingLabel : formatRange(earliest, latest);
}
