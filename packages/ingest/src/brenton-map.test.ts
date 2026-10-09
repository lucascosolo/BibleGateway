import { describe, expect, it } from "vitest";
import { mapSourceVerse, TRANSLATION_SOURCES } from "./translations";

const lxx = TRANSLATION_SOURCES.find((t) => t.code === "LXX")!;

describe("LXX (Brenton) coverage", () => {
  it("includes Deuteronomy and keeps the books already verified", () => {
    for (const id of [5, 16, 25, 35, 37]) expect(lxx.includedBookIds).toContain(id);
  });
  it("still excludes Genesis, Exodus, Leviticus and Numbers", () => {
    for (const id of [1, 2, 3, 4]) expect(lxx.includedBookIds).not.toContain(id);
  });
  it("names Deuteronomy in its scope note", () => {
    expect(lxx.scopeNote).toContain("Deuteronomy");
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
