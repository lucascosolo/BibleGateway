/**
 * The canonical verse address space.
 *
 * Every feature in Jot — annotations, cross-references, timeline anchors, map pins,
 * source-criticism spans, variant apparatus — points at text using a VerseId and nothing
 * else. That single shared identity is what lets a highlight made in a hover tooltip
 * re-render in the reader, the side panel and the timeline modal without any of them
 * knowing about each other.
 *
 * Encoding is BBCCCVVV as a plain integer:
 *
 *     verse_id = book * 1_000_000 + chapter * 1_000 + verse
 *
 * Genesis 1:1  -> 1_001_001
 * John 3:16    -> 43_003_016
 *
 * Why an integer rather than a string:
 *   - Sortable, so a passage is one indexed b-tree range scan, never a join.
 *   - Translation-independent: the *text* of John 3:16 differs per translation, the
 *     *address* does not.
 *   - 4 bytes in every annotation and cross-reference row.
 *
 * The space is deliberately SPARSE. 1_001_032 is a valid encoding but not a real verse
 * (Genesis 1 has 31 verses). Anything that walks a range must intersect against the real
 * verse set rather than assuming every id between two endpoints exists — expanding a range
 * that crosses a chapter or book boundary otherwise invents thousands of phantom verses.
 */

/** A verse address in BBCCCVVV form. Branded so a raw number cannot be passed by mistake. */
export type VerseId = number & { readonly __brand: "VerseId" };

/** 1-based book number in canonical order: Genesis = 1 ... Revelation = 66. */
export type BookId = number & { readonly __brand: "BookId" };

export const BOOK_FACTOR = 1_000_000;
export const CHAPTER_FACTOR = 1_000;

/** Highest chapter/verse the encoding can represent without carrying into the next field. */
export const MAX_CHAPTER = 999;
export const MAX_VERSE = 999;

export class InvalidReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReferenceError";
  }
}

/**
 * Encode a (book, chapter, verse) triple.
 *
 * Validates only that the parts fit the encoding — it cannot know whether the verse
 * actually exists, since that requires the canon. Use `BookIndex.exists()` for that.
 */
export function toVerseId(book: number, chapter: number, verse: number): VerseId {
  if (!Number.isInteger(book) || book < 1) {
    throw new InvalidReferenceError(`book must be a positive integer, got ${book}`);
  }
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > MAX_CHAPTER) {
    throw new InvalidReferenceError(`chapter must be 1-${MAX_CHAPTER}, got ${chapter}`);
  }
  if (!Number.isInteger(verse) || verse < 1 || verse > MAX_VERSE) {
    throw new InvalidReferenceError(`verse must be 1-${MAX_VERSE}, got ${verse}`);
  }
  return (book * BOOK_FACTOR + chapter * CHAPTER_FACTOR + verse) as VerseId;
}

export interface VerseParts {
  book: BookId;
  chapter: number;
  verse: number;
}

/** Decode a VerseId back into its parts. */
export function fromVerseId(id: VerseId): VerseParts {
  return {
    book: Math.floor(id / BOOK_FACTOR) as BookId,
    chapter: Math.floor((id % BOOK_FACTOR) / CHAPTER_FACTOR),
    verse: id % CHAPTER_FACTOR,
  };
}

export const bookOf = (id: VerseId): BookId => Math.floor(id / BOOK_FACTOR) as BookId;
export const chapterOf = (id: VerseId): number => Math.floor((id % BOOK_FACTOR) / CHAPTER_FACTOR);
export const verseOf = (id: VerseId): number => id % CHAPTER_FACTOR;

/**
 * How many chapters a range touches, or `Infinity` when it crosses a book boundary.
 *
 * Computed from the endpoints alone, with no database round trip, because the reader has to
 * decide whether a reference is a *passage* or a *container* before it fetches anything —
 * fetching first is how `/read/Ps` came to load 2,461 verses in order to discover it should
 * not have. Book-crossing returns `Infinity` rather than a count because chapter numbers
 * restart per book and the arithmetic is meaningless across the boundary; every such range is
 * long enough to want browsing anyway.
 */
export function chapterSpan(range: VerseRange): number {
  if (bookOf(range.start) !== bookOf(range.end)) return Infinity;
  return chapterOf(range.end) - chapterOf(range.start) + 1;
}

/** True if two addresses are in the same book. */
export const sameBook = (a: VerseId, b: VerseId): boolean => bookOf(a) === bookOf(b);

/** True if two addresses are in the same chapter of the same book. */
export const sameChapter = (a: VerseId, b: VerseId): boolean =>
  Math.floor(a / CHAPTER_FACTOR) === Math.floor(b / CHAPTER_FACTOR);

/** First representable id in a chapter — the lower bound for a chapter range scan. */
export const chapterStart = (book: number, chapter: number): VerseId =>
  toVerseId(book, chapter, 1);

/** Last representable id in a chapter — the upper bound for a chapter range scan. */
export const chapterEnd = (book: number, chapter: number): VerseId =>
  (book * BOOK_FACTOR + chapter * CHAPTER_FACTOR + MAX_VERSE) as VerseId;

/** Bounds covering an entire book. Safe as SQL `BETWEEN` endpoints. */
export function bookBounds(book: number): VerseRange {
  if (!Number.isInteger(book) || book < 1) {
    throw new InvalidReferenceError(`book must be a positive integer, got ${book}`);
  }
  return {
    start: (book * BOOK_FACTOR + CHAPTER_FACTOR + 1) as VerseId,
    end: (book * BOOK_FACTOR + MAX_CHAPTER * CHAPTER_FACTOR + MAX_VERSE) as VerseId,
  };
}

/**
 * A contiguous span of the canon, inclusive at both ends.
 *
 * This is THE query shape of the entire application. A hover tooltip showing one verse and
 * a reader showing all of Romans issue the identical query with different bounds:
 *
 *     WHERE start_verse_id <= range.end AND end_verse_id >= range.start
 */
export interface VerseRange {
  start: VerseId;
  end: VerseId;
}

/** A range covering exactly one verse. */
export const singleton = (id: VerseId): VerseRange => ({ start: id, end: id });

export function makeRange(start: VerseId, end: VerseId): VerseRange {
  return start <= end ? { start, end } : { start: end, end: start };
}

export const rangeContains = (range: VerseRange, id: VerseId): boolean =>
  id >= range.start && id <= range.end;

/** True if two ranges share any verse. The overlap test used by every annotation lookup. */
export const rangesOverlap = (a: VerseRange, b: VerseRange): boolean =>
  a.start <= b.end && a.end >= b.start;

/** Merge overlapping/adjacent ranges into a minimal sorted set. */
export function mergeRanges(ranges: readonly VerseRange[]): VerseRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: VerseRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const next = sorted[i];
    // `<= last.end + 1` merges touching ranges as well as overlapping ones.
    if (next.start <= last.end + 1) {
      if (next.end > last.end) last.end = next.end;
    } else {
      out.push({ ...next });
    }
  }
  return out;
}
