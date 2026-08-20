/**
 * Reference parsing and formatting.
 *
 * Everything that turns human or stored text into an address goes through here: the command
 * palette, URL segments, search input, cross-reference datasets, and user-typed notes. It is
 * small, pure and heavily tested on purpose — a bug here mis-anchors annotations, and
 * mis-anchored annotations are very hard to unwind once users have created them.
 *
 * Supported input:
 *   John 3:16            single verse
 *   Jn 3:16-18           verse range within a chapter
 *   John 3:16-4:2        range crossing chapters
 *   Gen 1:1-Exod 2:3     range crossing books
 *   John 3               whole chapter
 *   John                 whole book
 *   1 John 2:1           ordinal books, in any spelling (1/I/First)
 *   Ps 23; Rom 8:28      lists, separated by ; or ,
 *   John.3.16            OSIS form, as used by the ingest datasets
 */
import { BookIndex } from "./book-index";
import {
  type VerseId,
  type VerseRange,
  InvalidReferenceError,
  bookBounds,
  chapterEnd,
  chapterOf,
  bookOf,
  verseOf,
  makeRange,
  toVerseId,
} from "./verse-id";

export interface ParsedReference extends VerseRange {
  /** The text this was parsed from, for round-tripping and error messages. */
  raw: string;
  /** True when the reference named no verse (a whole chapter or whole book). */
  isWhole: "book" | "chapter" | null;
}

/** Matches "Book c:v", "Book c", or "Book" — the head of any reference. */
const REF_HEAD =
  /^\s*((?:[1-3]|i{1,3}|first|second|third|1st|2nd|3rd)?[\s.]*[a-z][a-z\s.]*?)\s*(?:(\d+)\s*(?::\s*(\d+))?)?\s*$/i;

/**
 * Parse a single reference (no separators). Throws InvalidReferenceError on bad input.
 */
export function parseReference(input: string, books: BookIndex): ParsedReference {
  const raw = input.trim();
  if (!raw) throw new InvalidReferenceError("empty reference");

  // OSIS form first — unambiguous, and the shape our datasets speak.
  const osis = parseOsis(raw, books);
  if (osis) return osis;

  // Split on the range separator, being careful not to eat hyphens inside book names
  // ("Song of Songs" has none, but be conservative and only split on the LAST plausible
  // separator that is followed by a digit).
  const dashMatch = raw.match(/^(.*?)\s*[-–—]\s*(\d.*|[a-z].*\d.*)$/i);

  if (!dashMatch) {
    return expandSingle(raw, books, raw);
  }

  const [, leftText, rightText] = dashMatch;
  const left = expandSingle(leftText, books, raw);

  // The right side may be "18", "4:2", or a full "Exod 2:3".
  const right = parseRangeEnd(rightText, left, books, raw);

  return {
    ...makeRange(left.start, right),
    raw,
    isWhole: null,
  };
}

function parseOsis(raw: string, books: BookIndex): ParsedReference | null {
  // "John.3.16" / "1Cor.13" / "Gen"
  const m = raw.match(/^([1-3]?[A-Za-z]+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return null;
  const book = books.find(m[1]);
  // Only treat it as OSIS when the dotted form actually resolves; otherwise fall through
  // so "Mt. 5" style input is handled by the normal parser.
  if (!book || (!m[2] && !raw.includes("."))) return null;

  if (!m[2]) return { ...bookBounds(book.bookId), raw, isWhole: "book" };
  const chapter = Number(m[2]);
  requireChapter(book.chapterCount, chapter, book.name, raw);
  if (!m[3]) {
    return {
      start: toVerseId(book.bookId, chapter, 1),
      end: chapterEnd(book.bookId, chapter),
      raw,
      isWhole: "chapter",
    };
  }
  const id = toVerseId(book.bookId, chapter, Number(m[3]));
  return { start: id, end: id, raw, isWhole: null };
}

function expandSingle(text: string, books: BookIndex, raw: string): ParsedReference {
  // A range endpoint may itself be in OSIS form ("John.3.16" from a URL slug), which
  // REF_HEAD does not accept because of the dots.
  const asOsis = parseOsis(text.trim(), books);
  if (asOsis) return asOsis;

  const m = text.match(REF_HEAD);
  if (!m) throw new InvalidReferenceError(`could not parse reference: "${raw}"`);

  const [, bookText, chapterStr, verseStr] = m;
  const book = books.require(bookText.trim());

  if (chapterStr === undefined) {
    return { ...bookBounds(book.bookId), raw, isWhole: "book" };
  }

  const chapter = Number(chapterStr);

  // A single-chapter book addressed as "Jude 5" means verse 5, not chapter 5.
  if (book.chapterCount === 1 && verseStr === undefined && chapter > 1) {
    const id = toVerseId(book.bookId, 1, chapter);
    return { start: id, end: id, raw, isWhole: null };
  }

  requireChapter(book.chapterCount, chapter, book.name, raw);

  if (verseStr === undefined) {
    return {
      start: toVerseId(book.bookId, chapter, 1),
      end: chapterEnd(book.bookId, chapter),
      raw,
      isWhole: "chapter",
    };
  }

  const id = toVerseId(book.bookId, chapter, Number(verseStr));
  return { start: id, end: id, raw, isWhole: null };
}

/** Resolve the right-hand side of a range, inheriting book/chapter from the left when omitted. */
function parseRangeEnd(text: string, left: ParsedReference, books: BookIndex, raw: string): VerseId {
  const trimmed = text.trim();

  // "18" — same book and chapter as the left side.
  if (/^\d+$/.test(trimmed)) {
    const leftBook = bookOf(left.start);
    // "John 3-5" (left is a whole chapter) means through the end of chapter 5.
    if (left.isWhole === "chapter") {
      const chapter = Number(trimmed);
      const book = books.get(leftBook as number);
      if (book) requireChapter(book.chapterCount, chapter, book.name, raw);
      return chapterEnd(leftBook as number, chapter);
    }
    return toVerseId(leftBook as number, chapterOf(left.start), Number(trimmed));
  }

  // "4:2" — same book, new chapter. The dotted form appears in URL slugs ("John.3.16-4.2").
  const chapterVerse = trimmed.match(/^(\d+)\s*[:.]\s*(\d+)$/);
  if (chapterVerse) {
    const leftBook = bookOf(left.start);
    const chapter = Number(chapterVerse[1]);
    const book = books.get(leftBook as number);
    if (book) requireChapter(book.chapterCount, chapter, book.name, raw);
    return toVerseId(leftBook as number, chapter, Number(chapterVerse[2]));
  }

  // Otherwise a full reference: "Exod 2:3".
  const parsed = expandSingle(trimmed, books, raw);
  return parsed.end;
}

function requireChapter(chapterCount: number, chapter: number, bookName: string, raw: string): void {
  if (chapter < 1 || chapter > chapterCount) {
    throw new InvalidReferenceError(
      `${bookName} has ${chapterCount} chapter${chapterCount === 1 ? "" : "s"}; got ${chapter} in "${raw}"`
    );
  }
}

/**
 * Parse a list of references separated by `;` or `,`.
 *
 * A bare comma between numbers ("John 3:16, 18") is a verse list within the same chapter,
 * so commas only split when the following token names a book or a chapter:verse pair.
 */
export function parseReferenceList(input: string, books: BookIndex): ParsedReference[] {
  const out: ParsedReference[] = [];
  let context: ParsedReference | null = null;

  for (const chunk of input.split(";")) {
    if (!chunk.trim()) continue;
    // Split on every comma, then decide per part. A bare number ("18") or bare range
    // ("18-20") inherits the book and chapter from the previous reference; anything else is
    // a fresh reference. Deciding after the split is simpler and more robust than trying to
    // encode the distinction in a lookahead.
    for (const part of chunk.split(",")) {
      const text = part.trim();
      if (!text) continue;

      const bare = text.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
      if (bare && context) {
        const book = bookOf(context.start) as number;
        const chapter = chapterOf(context.start);
        const start = toVerseId(book, chapter, Number(bare[1]));
        const end = bare[2] ? toVerseId(book, chapter, Number(bare[2])) : start;
        out.push({ start, end, raw: text, isWhole: null });
        continue;
      }

      const parsed = parseReference(text, books);
      context = parsed;
      out.push(parsed);
    }
  }
  if (out.length === 0) throw new InvalidReferenceError(`no references found in "${input}"`);
  return out;
}

/** Try to parse; return null instead of throwing. For live-typing UI like the command palette. */
export function tryParseReference(input: string, books: BookIndex): ParsedReference | null {
  try {
    return parseReference(input, books);
  } catch {
    return null;
  }
}

// --- Formatting -------------------------------------------------------------------------

export interface FormatOptions {
  /** Use the short book form ("Jn" rather than "John"). */
  abbreviated?: boolean;
}

/** Render a range the way a person writes it: "John 3:16-18", "Rom 8", "Jude". */
export function formatRange(range: VerseRange, books: BookIndex, opts: FormatOptions = {}): string {
  const startBook = books.get(bookOf(range.start) as number);
  const endBook = books.get(bookOf(range.end) as number);
  if (!startBook || !endBook) return formatOsis(range.start, books);

  const name = opts.abbreviated ? startBook.abbreviation : startBook.name;
  const sc = chapterOf(range.start);
  const sv = verseOf(range.start);
  const ec = chapterOf(range.end);
  const ev = verseOf(range.end);

  // Whole book.
  const wholeBook = bookBounds(startBook.bookId);
  if (range.start === wholeBook.start && range.end === wholeBook.end) return name;

  // Crosses books.
  if (startBook.bookId !== endBook.bookId) {
    const endName = opts.abbreviated ? endBook.abbreviation : endBook.name;
    return `${name} ${sc}:${sv}–${endName} ${ec}:${ev}`;
  }

  // Whole chapter(s).
  if (sv === 1 && ev >= 999) {
    return sc === ec ? `${name} ${sc}` : `${name} ${sc}–${ec}`;
  }

  if (sc !== ec) return `${name} ${sc}:${sv}–${ec}:${ev}`;
  if (sv === ev) return `${name} ${sc}:${sv}`;
  return `${name} ${sc}:${sv}–${ev}`;
}

/** Render the OSIS form used by datasets and URLs: "John.3.16". */
export function formatOsis(id: VerseId, books: BookIndex): string {
  const book = books.get(bookOf(id) as number);
  const osisId = book?.osisId ?? String(bookOf(id));
  return `${osisId}.${chapterOf(id)}.${verseOf(id)}`;
}

/** URL-safe slug for a range: "John.3.16-18". Round-trips through parseReference. */
export function toUrlSlug(range: VerseRange, books: BookIndex): string {
  if (range.start === range.end) return formatOsis(range.start, books);
  const book = books.get(bookOf(range.start) as number);
  const osisId = book?.osisId ?? String(bookOf(range.start));
  const sc = chapterOf(range.start);
  const ec = chapterOf(range.end);
  if (bookOf(range.start) !== bookOf(range.end)) {
    return `${formatOsis(range.start, books)}-${formatOsis(range.end, books)}`;
  }
  if (sc === ec) return `${osisId}.${sc}.${verseOf(range.start)}-${verseOf(range.end)}`;
  return `${osisId}.${sc}.${verseOf(range.start)}-${ec}.${verseOf(range.end)}`;
}
