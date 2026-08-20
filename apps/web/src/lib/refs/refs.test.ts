import { describe, expect, it } from "vitest";

import { BookIndex, type BookRecord, normalizeBookKey } from "./book-index";
import { formatOsis, formatRange, parseReference, parseReferenceList, toUrlSlug, tryParseReference } from "./parse";
import {
  InvalidReferenceError,
  MAX_CHAPTER,
  bookBounds,
  chapterSpan,
  fromVerseId,
  mergeRanges,
  rangesOverlap,
  toVerseId,
  type VerseId,
} from "./verse-id";

// A representative slice of the canon: ordinal books, a one-chapter book, long and short.
const BOOKS: BookRecord[] = [
  { bookId: 1, osisId: "Gen", name: "Genesis", abbreviation: "Gen", testament: "OT", chapterCount: 50 },
  { bookId: 2, osisId: "Exod", name: "Exodus", abbreviation: "Exod", testament: "OT", chapterCount: 40 },
  { bookId: 19, osisId: "Ps", name: "Psalms", abbreviation: "Ps", testament: "OT", chapterCount: 150 },
  { bookId: 23, osisId: "Isa", name: "Isaiah", abbreviation: "Isa", testament: "OT", chapterCount: 66 },
  { bookId: 40, osisId: "Matt", name: "Matthew", abbreviation: "Matt", testament: "NT", chapterCount: 28 },
  { bookId: 43, osisId: "John", name: "John", abbreviation: "Jn", testament: "NT", chapterCount: 21 },
  { bookId: 45, osisId: "Rom", name: "Romans", abbreviation: "Rom", testament: "NT", chapterCount: 16 },
  { bookId: 46, osisId: "1Cor", name: "1 Corinthians", abbreviation: "1 Cor", testament: "NT", chapterCount: 16 },
  { bookId: 62, osisId: "1John", name: "1 John", abbreviation: "1 Jn", testament: "NT", chapterCount: 5 },
  { bookId: 65, osisId: "Jude", name: "Jude", abbreviation: "Jude", testament: "NT", chapterCount: 1 },
  { bookId: 66, osisId: "Rev", name: "Revelation", abbreviation: "Rev", testament: "NT", chapterCount: 22 },
];

const books = new BookIndex(BOOKS);
const parse = (s: string) => parseReference(s, books);

describe("verse id encoding", () => {
  it("encodes the canonical examples", () => {
    expect(toVerseId(1, 1, 1)).toBe(1_001_001);
    expect(toVerseId(43, 3, 16)).toBe(43_003_016);
  });

  it("round-trips through decode", () => {
    for (const [b, c, v] of [
      [1, 1, 1],
      [43, 3, 16],
      [19, 119, 176],
      [66, 22, 21],
    ] as const) {
      expect(fromVerseId(toVerseId(b, c, v))).toEqual({ book: b, chapter: c, verse: v });
    }
  });

  it("sorts in canonical reading order", () => {
    const ids = [toVerseId(43, 3, 16), toVerseId(1, 1, 1), toVerseId(19, 119, 1)];
    expect([...ids].sort((a, b) => a - b)).toEqual([toVerseId(1, 1, 1), toVerseId(19, 119, 1), toVerseId(43, 3, 16)]);
  });

  it("rejects out-of-range parts", () => {
    expect(() => toVerseId(0, 1, 1)).toThrow(InvalidReferenceError);
    expect(() => toVerseId(1, 0, 1)).toThrow(InvalidReferenceError);
    expect(() => toVerseId(1, 1, 1000)).toThrow(InvalidReferenceError);
    expect(() => toVerseId(1, 1.5, 1)).toThrow(InvalidReferenceError);
  });

  it("gives book bounds that contain every verse of the book but no other book", () => {
    const gen = bookBounds(1);
    expect(gen.start).toBeLessThanOrEqual(toVerseId(1, 1, 1));
    expect(gen.end).toBeGreaterThanOrEqual(toVerseId(1, 50, 26));
    expect(gen.end).toBeLessThan(toVerseId(2, 1, 1));
  });
});

describe("range algebra", () => {
  it("detects overlap inclusively at the boundary", () => {
    const a = { start: 1 as VerseId, end: 10 as VerseId };
    expect(rangesOverlap(a, { start: 10 as VerseId, end: 20 as VerseId })).toBe(true);
    expect(rangesOverlap(a, { start: 11 as VerseId, end: 20 as VerseId })).toBe(false);
  });

  it("merges overlapping and adjacent ranges", () => {
    const merged = mergeRanges([
      { start: 5 as VerseId, end: 8 as VerseId },
      { start: 1 as VerseId, end: 4 as VerseId },
      { start: 20 as VerseId, end: 25 as VerseId },
    ]);
    expect(merged).toEqual([
      { start: 1, end: 8 },
      { start: 20, end: 25 },
    ]);
  });
});

describe("book name resolution", () => {
  it("folds ordinals, punctuation and case to one key", () => {
    for (const form of ["1 John", "1John", "I John", "First John", "1 Jn.", "1jn", "  1  JOHN "]) {
      expect(books.find(form)?.bookId, form).toBe(62);
    }
  });

  it("does not mistake Romans for an ordinal", () => {
    expect(normalizeBookKey("Romans")).toBe("romans");
    expect(books.find("Romans")?.bookId).toBe(45);
    expect(books.find("Rom")?.bookId).toBe(45);
  });

  it("resolves common abbreviations", () => {
    expect(books.find("Jn")?.bookId).toBe(43);
    expect(books.find("Ps")?.bookId).toBe(19);
    expect(books.find("Psalm")?.bookId).toBe(19);
    expect(books.find("Mt")?.bookId).toBe(40);
  });

  it("returns undefined for nonsense", () => {
    expect(books.find("Hezekiah")).toBeUndefined();
  });
});

describe("parsing", () => {
  it("parses a single verse", () => {
    expect(parse("John 3:16")).toMatchObject({ start: 43_003_016, end: 43_003_016, isWhole: null });
  });

  it("parses a verse range within a chapter", () => {
    expect(parse("Jn 3:16-18")).toMatchObject({ start: 43_003_016, end: 43_003_018 });
  });

  it("parses a range crossing chapters", () => {
    expect(parse("John 3:16-4:2")).toMatchObject({ start: 43_003_016, end: 43_004_002 });
  });

  it("parses a range crossing books", () => {
    expect(parse("Gen 1:1-Exod 2:3")).toMatchObject({ start: 1_001_001, end: 2_002_003 });
  });

  it("parses a whole chapter", () => {
    const r = parse("John 3");
    expect(r.isWhole).toBe("chapter");
    expect(r.start).toBe(43_003_001);
    expect(r.end).toBeGreaterThanOrEqual(43_003_036);
    expect(r.end).toBeLessThan(43_004_001);
  });

  it("parses a whole book", () => {
    const r = parse("John");
    expect(r.isWhole).toBe("book");
    expect(r.start).toBeLessThanOrEqual(43_001_001);
    expect(r.end).toBeLessThan(44_000_000);
  });

  it("parses a chapter range", () => {
    const r = parse("John 3-5");
    expect(r.start).toBe(43_003_001);
    expect(r.end).toBeGreaterThanOrEqual(43_005_001);
    expect(r.end).toBeLessThan(43_006_001);
  });

  it("treats a bare number in a one-chapter book as a verse", () => {
    // "Jude 5" is Jude 1:5 — there is no chapter 5.
    expect(parse("Jude 5")).toMatchObject({ start: 65_001_005, end: 65_001_005 });
  });

  it("parses OSIS form", () => {
    expect(parse("John.3.16")).toMatchObject({ start: 43_003_016, end: 43_003_016 });
    expect(parse("1Cor.13")).toMatchObject({ isWhole: "chapter" });
  });

  it("rejects a chapter beyond the book", () => {
    expect(() => parse("John 22:1")).toThrow(/21 chapters/);
    expect(() => parse("Rev 23")).toThrow(InvalidReferenceError);
  });

  it("rejects unknown books and junk", () => {
    expect(() => parse("Hezekiah 3:1")).toThrow(InvalidReferenceError);
    expect(() => parse("")).toThrow(InvalidReferenceError);
  });

  it("tryParse returns null rather than throwing", () => {
    expect(tryParseReference("nonsense 99:99", books)).toBeNull();
    expect(tryParseReference("John 3:16", books)).not.toBeNull();
  });
});

describe("reference lists", () => {
  it("splits on semicolons", () => {
    const list = parseReferenceList("Ps 23; Rom 8:28", books);
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ start: 45_008_028 });
  });

  it("treats a bare number after a comma as a verse in the same chapter", () => {
    const list = parseReferenceList("John 3:16, 18", books);
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ start: 43_003_018, end: 43_003_018 });
  });

  it("splits a comma before a new book", () => {
    const list = parseReferenceList("John 3:16, Rom 8:28", books);
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ start: 45_008_028 });
  });
});

describe("formatting", () => {
  it("formats the shapes a person writes", () => {
    expect(formatRange({ start: 43_003_016 as VerseId, end: 43_003_016 as VerseId }, books)).toBe("John 3:16");
    expect(formatRange({ start: 43_003_016 as VerseId, end: 43_003_018 as VerseId }, books)).toBe("John 3:16–18");
    expect(formatRange({ start: 43_003_016 as VerseId, end: 43_004_002 as VerseId }, books)).toBe("John 3:16–4:2");
    expect(formatRange(bookBounds(65), books)).toBe("Jude");
  });

  it("honours the abbreviated option", () => {
    expect(
      formatRange({ start: 43_003_016 as VerseId, end: 43_003_016 as VerseId }, books, { abbreviated: true })
    ).toBe("Jn 3:16");
  });

  it("formats OSIS", () => {
    expect(formatOsis(43_003_016 as VerseId, books)).toBe("John.3.16");
    expect(formatOsis(46_013_001 as VerseId, books)).toBe("1Cor.13.1");
  });

  it("round-trips a url slug back through the parser", () => {
    for (const input of ["John 3:16", "John 3:16-18", "John 3:16-4:2", "Gen 1:1-Exod 2:3"]) {
      const parsed = parse(input);
      const slug = toUrlSlug(parsed, books);
      const reparsed = parse(slug);
      expect({ start: reparsed.start, end: reparsed.end }, `${input} -> ${slug}`).toEqual({
        start: parsed.start,
        end: parsed.end,
      });
    }
  });
});

/**
 * The reader decides whether a reference is a passage to render or a container to browse from
 * this alone, before it fetches anything. Getting it wrong in the permissive direction is how
 * `/read/Ps` came to emit a megabyte of HTML.
 */
describe("chapterSpan", () => {
  it("counts a single chapter as one", () => {
    expect(chapterSpan(parseReference("John 3", books))).toBe(1);
    expect(chapterSpan(parseReference("John 3:16", books))).toBe(1);
  });

  it("counts an inclusive chapter range", () => {
    expect(chapterSpan(parseReference("John 3-5", books))).toBe(3);
    expect(chapterSpan(parseReference("John 3:16-5:2", books))).toBe(3);
  });

  it("reports the ENCODED span for a whole book, not the real chapter count", () => {
    // `bookBounds` addresses a book as chapters 1-999 whatever it actually holds, so this is
    // a cheap upper bound and nothing more. The reader uses it only to decide whether the
    // real chapter list is worth querying — treating it as the answer would send Jude, one
    // chapter long, to an index containing a single link.
    expect(chapterSpan(parseReference("Ps", books))).toBe(MAX_CHAPTER);
    expect(chapterSpan(parseReference("Jude", books))).toBe(MAX_CHAPTER);
  });

  it("bounds the real chapter count from above", () => {
    // The property the reader relies on: real chapters are a subset of the encoded span, so a
    // span at or below the threshold can never hide a longer passage.
    const john = parseReference("John 3-5", books);
    expect(chapterSpan(john)).toBe(3);
    expect(chapterSpan(parseReference("John", books))).toBeGreaterThanOrEqual(21);
  });

  it("is infinite across a book boundary", () => {
    // Chapter numbers restart per book, so the subtraction has no meaning there.
    expect(chapterSpan(parseReference("Gen 1:1-Exod 2:3", books))).toBe(Infinity);
  });

});
