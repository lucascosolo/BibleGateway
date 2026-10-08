/**
 * Pure grouping, sorting and filtering for the Toledot index pages. No db imports: the pages
 * build plain items server-side and the client regroups them with these.
 */

export interface EraLike {
  id: string;
  name: string;
  start: number;
  end: number;
}

/** The era containing `year` (boundaries included), or null in a gap. Year 0 does not exist. */
export function assignEra<E extends EraLike>(eras: readonly E[], year: number): E | null {
  if (year === 0) throw new RangeError("There is no year 0");
  return eras.find((era) => year >= era.start && year <= era.end) ?? null;
}

/** Groups in era order, empty eras skipped, items in input order, unplaced items last. */
export function groupByEra<E extends EraLike, T>(
  eras: readonly E[],
  items: readonly T[],
  yearOf: (item: T) => number | null
): { era: E | null; items: T[] }[] {
  const byEra = new Map<string | null, T[]>();
  for (const item of items) {
    const year = yearOf(item);
    const key = year === null ? null : (assignEra(eras, year)?.id ?? null);
    byEra.set(key, [...(byEra.get(key) ?? []), item]);
  }
  const groups = eras.flatMap((era) => (byEra.has(era.id) ? [{ era, items: byEra.get(era.id)! }] : []));
  const unplaced = byEra.get(null);
  return unplaced ? [...groups, { era: null, items: unplaced }] : groups;
}

/** Sections in ascending book number, then a trailing `book: null` section "No verse yet". */
export function groupByBook<T>(
  items: readonly T[],
  bookOf: (item: T) => number | null,
  bookName: (book: number) => string
): { book: number | null; name: string; items: T[] }[] {
  const byBook = new Map<number | null, T[]>();
  for (const item of items) {
    const key = bookOf(item);
    byBook.set(key, [...(byBook.get(key) ?? []), item]);
  }
  const books = [...byBook.keys()].filter((k): k is number => k !== null).sort((a, b) => a - b);
  const sections = books.map((book) => ({ book: book as number | null, name: bookName(book), items: byBook.get(book)! }));
  const none = byBook.get(null);
  return none ? [...sections, { book: null, name: "No verse yet", items: none }] : sections;
}

/** Stable sort by year, ascending, nulls last. */
export function sortByYear<T>(items: readonly T[], yearOf: (item: T) => number | null): T[] {
  return items
    .map((item, index) => ({ item, index, year: yearOf(item) }))
    .sort((a, b) => {
      if (a.year === null || b.year === null) {
        return a.year === b.year ? a.index - b.index : a.year === null ? 1 : -1;
      }
      return a.year - b.year || a.index - b.index;
    })
    .map((entry) => entry.item);
}

/** The first sentence (a terminator, optional closing quotes, then a space), clipped at `max`. */
export function firstSentence(text: string, max = 180): string {
  const trimmed = text.trim();
  const end = /[.!?]["'”’)]*(?=\s)/.exec(trimmed);
  const sentence = end ? trimmed.slice(0, end.index + end[0].length) : trimmed;
  if (sentence.length <= max) return sentence;
  const clipped = sentence.slice(0, max);
  const cut = clipped.lastIndexOf(" ");
  return `${(cut > 0 ? clipped.slice(0, cut) : clipped).trimEnd()}…`;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** True when every whitespace-separated token of `query` appears in the fields, ignoring case and diacritics. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fold(fields.filter(Boolean).join(" "));
  return tokens.every((token) => haystack.includes(token));
}

/** Id of the era holding the most events by earliest year; ties go to the earlier era. */
export function eraWithMostEvents(eras: readonly EraLike[], events: readonly { earliest: number }[]): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const era of eras) {
    const count = events.filter((e) => e.earliest !== 0 && e.earliest >= era.start && e.earliest <= era.end).length;
    if (count > bestCount) {
      best = era.id;
      bestCount = count;
    }
  }
  return best;
}
