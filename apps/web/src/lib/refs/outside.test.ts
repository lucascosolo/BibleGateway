import { describe, expect, it } from "vitest";

import { BookIndex, type BookRecord } from "./book-index";
import { formatOsis, formatRange, parseReference } from "./parse";
import { InvalidReferenceError, bookBounds, type VerseId } from "./verse-id";

type Canon = NonNullable<BookRecord["canon"]>;
type Numbering = NonNullable<BookRecord["numbering"]>;

const core = (bookId: number, osisId: string, name: string, abbreviation: string, testament: "OT" | "NT", chapterCount: number): BookRecord => ({
  bookId, osisId, name, abbreviation, testament, chapterCount,
});
const out = (
  bookId: number, osisId: string, name: string, abbreviation: string, chapterCount: number,
  canon: Canon, numbering: Numbering,
): BookRecord => ({ bookId, osisId, name, abbreviation, testament: "DC", chapterCount, canon, numbering });

const BOOKS: BookRecord[] = [
  core(1, "Gen", "Genesis", "Gen", "OT", 50),
  core(19, "Ps", "Psalms", "Ps", "OT", 150),
  core(43, "John", "John", "Jn", "NT", 21),
  core(65, "Jude", "Jude", "Jude", "NT", 1),
  out(67, "Tob", "Tobit", "Tob", 14, "deuterocanon", "chapter-verse"),
  out(69, "AddEsth", "Additions to Esther", "Add Esth", 16, "deuterocanon", "chapter-verse"),
  out(71, "Sir", "Sirach", "Sir", 51, "deuterocanon", "chapter-verse"),
  out(73, "EpJer", "Letter of Jeremiah", "Ep Jer", 1, "deuterocanon", "chapter-verse"),
  out(74, "PrAzar", "Prayer of Azariah", "Pr Azar", 1, "deuterocanon", "chapter-verse"),
  out(77, "1Macc", "1 Maccabees", "1 Macc", 16, "deuterocanon", "chapter-verse"),
  out(83, "Ps151", "Psalm 151", "Ps 151", 1, "deuterocanon", "chapter-verse"),
  out(84, "2Esd", "2 Esdras", "2 Esd", 16, "deuterocanon", "chapter-verse"),
  out(85, "1En", "1 Enoch", "1 En", 108, "pseudepigrapha", "chapter-verse"),
  out(86, "Jub", "Jubilees", "Jub", 50, "pseudepigrapha", "chapter-verse"),
  out(89, "TLevi", "Testament of Levi", "T. Levi", 19, "pseudepigrapha", "chapter-verse"),
  out(101, "GThom", "Gospel of Thomas", "Gos. Thom.", 1, "nt-apocrypha", "logion"),
  out(102, "GPet", "Gospel of Peter", "Gos. Pet.", 1, "nt-apocrypha", "section"),
  out(110, "Did", "Didache", "Did.", 16, "apostolic", "chapter"),
  out(115, "IgnRom", "Ignatius to the Romans", "Ign. Rom.", 10, "apostolic", "chapter"),
  out(104, "InfThom", "Infancy Gospel of Thomas", "Inf. Thom.", 45, "nt-apocrypha", "part-chapter"),
  out(107, "GMary", "Gospel of Mary", "Gos. Mary", 9, "nt-apocrypha", "page"),
  out(108, "GJudas", "Gospel of Judas", "Gos. Judas", 26, "nt-apocrypha", "page"),
  out(109, "GPhil", "Gospel of Philip", "Gos. Phil.", 36, "nt-apocrypha", "page"),
  out(111, "1Clem", "1 Clement", "1 Clem.", 65, "apostolic", "chapter"),
  out(120, "Herm", "Shepherd of Hermas", "Herm.", 27, "apostolic", "part-chapter"),
];

const books = new BookIndex(BOOKS);
const parse = (s: string) => parseReference(s, books);

const expectVerse = (inputs: string[], id: number) => {
  for (const input of inputs) {
    const r = parse(input);
    expect([input, r.start, r.end]).toEqual([input, id, id]);
  }
};
const expectChapter = (inputs: string[], book: number, chapter: number) => {
  for (const input of inputs) {
    const r = parse(input);
    expect([input, r.start, r.isWhole]).toEqual([input, book * 1_000_000 + chapter * 1_000 + 1, "chapter"]);
  }
};

describe("outside books: single-chapter numbering", () => {
  it("reads a bare number in Gospel of Thomas as the logion", () => {
    expectVerse(["Thomas 42", "GThom 42", "Gos. Thom. 42", "Gospel of Thomas 42"], 101_001_042);
  });
  it("reads a bare number in Gospel of Peter as the section", () => {
    expectVerse(["Gospel of Peter 9", "GPet 9"], 102_001_009);
  });
  it("reads a bare number in Letter of Jeremiah, Prayer of Azariah", () => {
    expectVerse(["Letter of Jeremiah 5", "Epistle of Jeremy 5", "EpJer 5"], 73_001_005);
    expectVerse(["Prayer of Azariah 12", "Pr Azar 12", "Song of the Three 12"], 74_001_012);
  });
});

describe("outside books: aliases", () => {
  it("resolves Sirach spellings", () => {
    expectVerse(["Sir 1:1", "Sirach 1:1", "Ecclesiasticus 1:1", "Ecclus 1:1", "Ben Sira 1:1"], 71_001_001);
  });
  it("resolves 1 Enoch spellings", () => {
    expectVerse(["1 Enoch 1:9", "1En 1:9", "I Enoch 1:9", "1 En 1:9"], 85_001_009);
  });
  it("resolves Tobit, Maccabees, Esdras, Additions to Esther, Jubilees, Testament of Levi", () => {
    expectVerse(["Tob 4:8", "Tobit 4:8"], 67_004_008);
    expectVerse(["1 Macc 2:1", "1 Maccabees 2:1", "I Macc 2:1", "1Ma 2:1"], 77_002_001);
    expectVerse(["2 Esdras 7:1", "2 Esd 7:1", "4 Ezra 7:1"], 84_007_001);
    expectVerse(["Additions to Esther 13:9", "Add Esth 13:9", "Rest of Esther 13:9"], 69_013_009);
    expectVerse(["Jubilees 1:1", "Jub 1:1"], 86_001_001);
    expectVerse(["Testament of Levi 18:3", "T. Levi 18:3", "TLevi 18:3"], 89_018_003);
  });
});

describe("outside books: chapter-numbered works", () => {
  it("parses Didache and Ignatius as whole chapters", () => {
    expectChapter(["Didache 9", "Did 9"], 110, 9);
    expectChapter(["Ignatius to the Romans 4", "Ign. Rom. 4", "IgnRom 4"], 115, 4);
  });
});

describe("outside books: Shepherd of Hermas parts", () => {
  it("maps Vision n to chapter n", () => {
    expectChapter(["Hermas Vision 3", "Herm Vis 3", "Shepherd of Hermas Vision 3"], 120, 3);
  });
  it("maps Mandate n to chapter 100+n", () => {
    expectChapter(["Hermas Mandate 4", "Herm Mand 4"], 120, 104);
  });
  it("maps Parable/Similitude n to chapter 200+n", () => {
    expectChapter(["Hermas Parable 9", "Hermas Similitude 9", "Herm Sim 9"], 120, 209);
  });
  it("rejects numbers beyond each part", () => {
    expect(() => parse("Hermas Vision 6")).toThrow(InvalidReferenceError);
    expect(() => parse("Hermas Mandate 13")).toThrow(InvalidReferenceError);
    expect(() => parse("Hermas Parable 11")).toThrow(InvalidReferenceError);
  });
});

describe("outside books: Psalm 151", () => {
  it("is its own book", () => {
    for (const s of ["Psalm 151:3", "Ps 151:3"]) expect(parse(s).start).toBe(83_001_003);
    for (const s of ["Ps 151", "Psalm 151"]) {
      const r = parse(s);
      expect([r.start, r.end, r.isWhole]).toEqual([bookBounds(83).start, bookBounds(83).end, "book"]);
    }
  });
  it("leaves the Psalter alone", () => {
    expect(parse("Ps 150:1").start).toBe(19_150_001);
    const r = parse("Ps 23");
    expect([r.start, r.isWhole]).toEqual([19_023_001, "chapter"]);
  });
});

describe("outside books: prologue", () => {
  it("is chapter 1 verse 0, a singleton, not whole", () => {
    for (const [s, id] of [["Sirach prologue", 71_001_000], ["Sir prol", 71_001_000], ["Thomas prologue", 101_001_000]] as const) {
      const r = parse(s);
      expect([s, r.start, r.end, r.isWhole]).toEqual([s, id, id, null]);
    }
  });
});

describe("outside books: OSIS form and formatting", () => {
  it("parses OSIS references", () => {
    expect(parse("GThom.1.42").start).toBe(101_001_042);
    expect(parse("Sir.1.1").start).toBe(71_001_001);
  });
  it("formats OSIS", () => {
    expect(formatOsis(101_001_042 as VerseId, books)).toBe("GThom.1.42");
  });
  it("passes canon and numbering through the index", () => {
    expect(books.get(101)?.canon).toBe("nt-apocrypha");
    expect(books.get(101)?.numbering).toBe("logion");
  });
});

describe("bookBounds includes the verse-0 slot when the book has a prologue", () => {
  it("starts at chapter 1 verse 0", () => {
    expect(bookBounds(71, true).start).toBe(71_001_000);
    expect(bookBounds(71, true).end).toBe(71_999_999);
  });
  it("whole-book parse equals bookBounds and formats as the book name", () => {
    const r = parse("Sirach");
    expect([r.start, r.end]).toEqual([bookBounds(71).start, bookBounds(71).end]);
    expect(formatRange(r, books)).toBe("Sirach");
  });
});

describe("existing books are unaffected", () => {
  it("parses John and Jude", () => {
    expect(parse("John 3:16").start).toBe(43_003_016);
    expect(parse("Jude 5").start).toBe(65_001_005);
  });
});

describe("outside books: real chapter counts and page numbering", () => {
  it("reads Thomas 77 as logion 77 although the book has one chapter", () => {
    expectVerse(["Thomas 77"], 101_001_077);
  });
  it("parses Didache, 1 Clement and Ignatius Romans as whole chapters", () => {
    expectChapter(["Didache 9"], 110, 9);
    expectChapter(["1 Clement 5"], 111, 5);
    expectChapter(["Ignatius Romans 4"], 115, 4);
  });
  it("keeps Hermas part bands with 27 real chapters", () => {
    expectChapter(["Hermas Mandate 4"], 120, 104);
    expect(() => parse("Hermas Vision 6")).toThrow(InvalidReferenceError);
  });
  it("reads 1 Enoch chapter:verse", () => {
    expectVerse(["1 Enoch 1:9"], 85_001_009);
  });
  it("does not reject a page number above chapter_count for page books", () => {
    expectChapter(["Gospel of Mary 9"], 107, 9);
    expectChapter(["Gospel of Judas 33"], 108, 33);
    expectVerse(["Gospel of Philip 86:2"], 109_086_002);
  });
});

describe("short OSIS form for single-chapter books", () => {
  it("reads Book.verse as chapter 1 verse N", () => {
    for (const [s, id] of [["GThom.42", 101_001_042], ["GThom.1.42", 101_001_042], ["GPet.9", 102_001_009], ["Jude.5", 65_001_005], ["GThom 42", 101_001_042]] as const) {
      const r = parse(s);
      expect([s, r.start, r.end, r.isWhole]).toEqual([s, id, id, null]);
    }
  });
  it("keeps Book.1 on a one-chapter book as the whole chapter", () => {
    const r = parse("GThom.1");
    expect([r.start, r.isWhole]).toEqual([101_001_001, "chapter"]);
  });
});

describe("hasPrologue drives whole-book bounds", () => {
  const withPrologue = new BookIndex(BOOKS.map((b) => (b.bookId === 71 ? { ...b, hasPrologue: true } : b)));
  it("bookBounds starts at verse 0 only for a book with a prologue", () => {
    expect(bookBounds(1).start).toBe(1_001_001);
    expect(bookBounds(71).start).toBe(71_001_001);
    expect(bookBounds(71, true).start).toBe(71_001_000);
    expect(bookBounds(71, true).end).toBe(71_999_999);
  });
  it("a whole-book parse uses the record's flag", () => {
    const sir = parseReference("Sirach", withPrologue);
    expect([sir.start, sir.isWhole]).toEqual([71_001_000, "book"]);
    expect(parseReference("Genesis", withPrologue).start).toBe(1_001_001);
    expect(parseReference("Gen", withPrologue).start).toBe(1_001_001);
  });
});

describe("lastChapter bounds a chapter (sparse chapter numbering)", () => {
  const addEsth = (extra: Partial<BookRecord>): BookRecord => ({
    bookId: 69, osisId: "AddEsth", name: "Additions to Esther", abbreviation: "Add Esth",
    testament: "DC", chapterCount: 7, canon: "deuterocanon", numbering: "chapter-verse", ...extra,
  });
  const withLast = new BookIndex([addEsth({ lastChapter: 16 })]);

  it("resolves chapter 10 and rejects chapter 17 when lastChapter is 16", () => {
    expect(parseReference("AddEsth.10", withLast).start).toBe(69_010_001);
    expect(() => parseReference("AddEsth.17", withLast)).toThrow(InvalidReferenceError);
  });

  it("still rejects chapter 10 without lastChapter", () => {
    expect(() => parseReference("AddEsth.10", new BookIndex([addEsth({})]))).toThrow(InvalidReferenceError);
  });

  it("isPlausible accepts 69_016_001 with lastChapter 16", () => {
    expect(withLast.isPlausible(69_016_001)).toBe(true);
  });
});
