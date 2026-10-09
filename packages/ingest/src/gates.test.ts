import { describe, expect, it } from "vitest";
import {
  CANONICAL_EXTRA_VERSES,
  TRANSLATION_SOURCES,
  unexplainedGaps,
  unplacedGateErrors,
} from "./translations";

const lxx = TRANSLATION_SOURCES.find((t) => t.code === "LXX")!;

describe("unplacedGateErrors", () => {
  it("passes when the skipped count equals the reviewed count and the list length", () => {
    expect(unplacedGateErrors(lxx, 16)).toEqual([]);
  });

  it("fails when a seventeenth verse is listed and skipped but the reviewed count is still 16", () => {
    const grown = {
      ...lxx,
      unplacedSourceVerses: [...lxx.unplacedSourceVerses!, { bookId: 2, chapter: 40, verse: 99 }],
    };
    const errors = unplacedGateErrors(grown, 17);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("LXX") && e.includes("17") && e.includes("16"))).toBe(true);
  });

  it("fails when fewer verses were skipped than reviewed", () => {
    const errors = unplacedGateErrors(lxx, 15);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("LXX"))).toBe(true);
  });

  it("declares 16 reviewed unplaced verses for LXX, equal to its list", () => {
    expect(lxx.reviewedUnplacedCount).toBe(16);
    expect(lxx.unplacedSourceVerses).toHaveLength(16);
  });

  // KJVA (the King James Apocrypha, added with the outside books on 2026-10-09) has three
  // reviewed unplaced verses: Sirach 20:3, 22:9 and 22:10, whose Brenton numbers hold other text.
  it("declares 3 reviewed unplaced verses for KJVA, equal to its list", () => {
    const kjva = TRANSLATION_SOURCES.find((t) => t.code === "KJVA")!;
    expect(kjva.reviewedUnplacedCount).toBe(3);
    expect(kjva.unplacedSourceVerses).toHaveLength(3);
  });

  it("gives every other translation no unplaced list, a zero count, and a clean gate at 0", () => {
    for (const t of TRANSLATION_SOURCES.filter((x) => x.code !== "LXX" && x.code !== "KJVA")) {
      expect(t.reviewedUnplacedCount ?? 0).toBe(0);
      expect(t.unplacedSourceVerses).toBeUndefined();
      expect(unplacedGateErrors(t, 0)).toEqual([]);
    }
  });
});

describe("unexplainedGaps", () => {
  const canonical = [1_001_001, 1_001_002, 40_001_001, 44_008_036, 44_008_037, 44_008_038];
  const all = new Set(canonical);
  const without = (...ids: number[]) => new Set(canonical.filter((i) => !ids.includes(i)));

  it("reports a printed-book verse with no text and no omission row", () => {
    const t = { scope: "all" as const, printedBookIds: new Set([1, 40, 44]), explained: without(44_008_037) };
    expect(unexplainedGaps(canonical, t)).toEqual([44_008_037]);
  });

  it("returns every gap in ascending order", () => {
    const t = {
      scope: "all" as const,
      printedBookIds: new Set([1, 40, 44]),
      explained: without(44_008_037, 1_001_002),
    };
    expect(unexplainedGaps([...canonical].reverse(), t)).toEqual([1_001_002, 44_008_037]);
  });

  it("returns nothing when everything is explained", () => {
    const t = { scope: "all" as const, printedBookIds: new Set([1, 40, 44]), explained: all };
    expect(unexplainedGaps(canonical, t)).toEqual([]);
  });

  it("ignores the New Testament for an OT-scope translation", () => {
    const t = { scope: "OT" as const, printedBookIds: new Set([1]), explained: new Set([1_001_001, 1_001_002]) };
    expect(unexplainedGaps(canonical, t)).toEqual([]);
  });

  it("reports a missing NT verse for an NT-scope translation and ignores the OT", () => {
    const t = {
      scope: "NT" as const,
      printedBookIds: new Set([1, 40, 44]),
      explained: without(40_001_001, 1_001_001),
    };
    expect(unexplainedGaps(canonical, t)).toEqual([40_001_001]);
  });

  it("does not report books the translation does not print", () => {
    const t = { scope: "all" as const, printedBookIds: new Set([1]), explained: new Set<number>() };
    expect(unexplainedGaps(canonical, t)).toEqual([1_001_001, 1_001_002]);
  });

  it("reports every CANONICAL_EXTRA_VERSES id when nothing explains them (Acts 8:37 regression)", () => {
    const ids = CANONICAL_EXTRA_VERSES.map((v) => v.bookId * 1_000_000 + v.chapter * 1_000 + v.verse);
    const books = new Set(CANONICAL_EXTRA_VERSES.map((v) => v.bookId));
    const t = { scope: "all" as const, printedBookIds: books, explained: new Set<number>() };
    expect(unexplainedGaps(ids, t)).toEqual([...ids].sort((a, b) => a - b));
    expect(unexplainedGaps(ids, t)).toContain(44_008_037);
  });
});
