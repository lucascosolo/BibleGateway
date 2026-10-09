import { describe, expect, it } from "vitest";
import { isUnplacedSourceVerse, mapSourceVerse, TRANSLATION_SOURCES } from "./translations";

const lxx = TRANSLATION_SOURCES.find((t) => t.code === "LXX")!;

describe("LXX (Brenton) coverage", () => {
  it("includes Deuteronomy and keeps the books already verified", () => {
    for (const id of [5, 16, 25, 35, 37]) expect(lxx.includedBookIds).toContain(id);
  });
  it("includes the whole Pentateuch and the books already verified", () => {
    for (const id of [1, 2, 3, 4, 5, 16, 25, 35, 37]) expect(lxx.includedBookIds).toContain(id);
  });
  it("names all five books of the Pentateuch in its scope note", () => {
    for (const name of ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"])
      expect(lxx.scopeNote).toContain(name);
  });
});

describe("unplaced source verses", () => {
  const list = lxx.unplacedSourceVerses ?? [];
  it("lists 16 for the LXX: 13 in Exodus, 1 in Leviticus, 2 in Numbers, none in Genesis", () => {
    expect(list).toHaveLength(16);
    const n = (b: number) => list.filter((u) => u.bookId === b).length;
    expect([n(1), n(2), n(3), n(4)]).toEqual([0, 13, 1, 2]);
  });
  it("recognises the reviewed unplaced verses and nothing next to them", () => {
    expect(isUnplacedSourceVerse(lxx, 2, 36, 8)).toBe(true);
    expect(isUnplacedSourceVerse(lxx, 3, 8, 30)).toBe(true);
    expect(isUnplacedSourceVerse(lxx, 4, 21, 21)).toBe(true);
    expect(isUnplacedSourceVerse(lxx, 4, 27, 7)).toBe(true);
    expect(isUnplacedSourceVerse(lxx, 2, 36, 9)).toBe(false);
  });
  it("is false when the field is absent, and only matches its own book", () => {
    expect(isUnplacedSourceVerse({}, 2, 36, 8)).toBe(false);
    const t = { unplacedSourceVerses: [{ bookId: 2, chapter: 36, verse: 8 }] };
    expect(isUnplacedSourceVerse(t, 2, 36, 8)).toBe(true);
    expect(isUnplacedSourceVerse(t, 3, 36, 8)).toBe(false);
  });
});

describe("mapSourceVerse with the real LXX table", () => {
  const cases: [number, number, number, number, number][] = [
    [5, 13, 1, 12, 32],
    [5, 13, 2, 13, 1],
    [5, 13, 19, 13, 18],
    [5, 23, 1, 22, 30],
    [5, 23, 2, 23, 1],
    [5, 23, 24, 23, 23],
    [5, 23, 25, 23, 25],
    [5, 23, 26, 23, 24],
    [5, 32, 8, 32, 8],
    [5, 12, 31, 12, 31],
    [16, 1, 1, 1, 1],
    [1, 32, 1, 31, 55],
    [1, 32, 33, 32, 32],
    [1, 31, 50, 31, 50],
    [2, 7, 26, 8, 1],
    [2, 8, 28, 8, 32],
    [2, 20, 15, 20, 13],
    [2, 21, 16, 21, 17],
    [2, 21, 37, 22, 1],
    [2, 22, 30, 22, 31],
    [2, 36, 9, 39, 2],
    [2, 36, 38, 39, 31],
    [2, 38, 27, 40, 31],
    [2, 39, 13, 39, 1],
    [3, 5, 20, 6, 1],
    [3, 6, 23, 6, 30],
    [3, 8, 19, 8, 20],
    [3, 8, 29, 8, 30],
    [4, 1, 36, 1, 24],
    [4, 10, 36, 10, 34],
    [4, 17, 1, 16, 36],
    [4, 17, 28, 17, 13],
    [4, 26, 24, 26, 15],
    [4, 30, 1, 29, 40],
    [4, 30, 17, 30, 16],
  ];
  for (const [b, c, v, cc, cv] of cases) {
    it(`maps book ${b} ${c}:${v} to ${cc}:${cv}`, () => {
      expect(mapSourceVerse(lxx, b, c, v)).toEqual({ chapter: cc, verse: cv });
    });
  }

  it("is one-to-one over Deuteronomy 13 and 23", () => {
    const seen = new Set<string>();
    const add = (c: number, n: number) => {
      for (let v = 1; v <= n; v++) {
        const m = mapSourceVerse(lxx, 5, c, v);
        seen.add(`${m.chapter}:${m.verse}`);
      }
    };
    add(13, 19);
    add(23, 26);
    expect(seen.size).toBe(19 + 26);
  });

  const distinctTargets = (book: number, chapters: [number, number][]) => {
    const seen = new Set<string>();
    for (const [c, n] of chapters)
      for (let v = 1; v <= n; v++) {
        if (isUnplacedSourceVerse(lxx, book, c, v)) continue;
        const m = mapSourceVerse(lxx, book, c, v);
        seen.add(`${m.chapter}:${m.verse}`);
      }
    return seen.size;
  };
  it("is one-to-one over Exodus 36-39 once unplaced verses are set aside", () => {
    expect(distinctTargets(2, [[36, 38], [37, 21], [38, 27], [39, 23]])).toBe(96);
  });
  it("is one-to-one over Numbers 26", () => {
    expect(distinctTargets(4, [[26, 65]])).toBe(65);
  });
  it("is one-to-one over Leviticus 5 and 6", () => {
    expect(distinctTargets(3, [[5, 26], [6, 23]])).toBe(49);
  });
  it("is one-to-one over Genesis 32", () => {
    expect(distinctTargets(1, [[32, 33]])).toBe(33);
  });
});

describe("mapSourceVerse as a pure function", () => {
  it("is the identity when there is no verseOffsets table", () => {
    expect(mapSourceVerse({}, 5, 13, 1)).toEqual({ chapter: 13, verse: 1 });
  });
  it("applies an entry only to its own book", () => {
    const t = {
      verseOffsets: [
        { bookId: 5, chapter: 13, fromVerse: 1, toVerse: 1, canonicalChapter: 12, canonicalFirstVerse: 32 },
      ],
    };
    expect(mapSourceVerse(t, 5, 13, 1)).toEqual({ chapter: 12, verse: 32 });
    expect(mapSourceVerse(t, 4, 13, 1)).toEqual({ chapter: 13, verse: 1 });
  });
});
