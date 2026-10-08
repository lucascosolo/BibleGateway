import { describe, expect, it } from "vitest";

import { assignEra, eraWithMostEvents, firstSentence, groupByBook, groupByEra, matchesQuery, sortByYear, type EraLike } from "./catalogue";

const era = (id: string, start: number, end: number): EraLike => ({ id, name: id, start, end });
const eras = [era("a", -1000, -900), era("b", -800, -700), era("c", -600, -500)];

describe("assignEra", () => {
  it("finds the era containing the year, boundaries included", () => {
    expect(assignEra(eras, -750)?.id).toBe("b");
    expect(assignEra(eras, -1000)?.id).toBe("a");
    expect(assignEra(eras, -900)?.id).toBe("a");
  });
  it("returns null in a gap and before the first era", () => {
    expect(assignEra(eras, -850)).toBeNull();
    expect(assignEra(eras, -1100)).toBeNull();
  });
  it("throws RangeError for year 0", () => {
    expect(() => assignEra(eras, 0)).toThrow(RangeError);
  });
});

describe("groupByEra", () => {
  const items = [
    { n: "x1", y: -550 as number | null },
    { n: "x2", y: -950 },
    { n: "x3", y: null },
    { n: "x4", y: -520 },
    { n: "x5", y: -850 },
  ];
  const groups = groupByEra(eras, items, (i) => i.y);

  it("orders groups by era order, skips empty eras, keeps item order, trails unplaced", () => {
    expect(groups.map((g) => g.era?.id ?? null)).toEqual(["a", "c", null]);
    expect(groups[1].items.map((i) => i.n)).toEqual(["x1", "x4"]);
    expect(groups[2].items.map((i) => i.n)).toEqual(["x3", "x5"]);
  });
  it("omits the unplaced group when empty and returns [] for no input", () => {
    expect(groupByEra(eras, [{ y: -950 }], (i) => i.y).map((g) => g.era?.id)).toEqual(["a"]);
    expect(groupByEra(eras, [], () => null)).toEqual([]);
  });
});

describe("firstSentence", () => {
  it("returns a plain sentence", () => {
    expect(firstSentence("Hello world.")).toBe("Hello world.");
  });
  it("stops after the first of two sentences", () => {
    expect(firstSentence("One here. Two there.")).toBe("One here.");
    expect(firstSentence("Really? Yes!")).toBe("Really?");
  });
  it("treats 'c. 586 BCE.' abbreviations as sentence ends (period + space ends it)", () => {
    expect(firstSentence("Fell c. 586 BCE. Later.")).toBe("Fell c.");
  });
  it("ends at a period followed by a quote mark then space", () => {
    expect(firstSentence('He said "go." Then left.')).toBe('He said "go."');
  });
  it("clips long sentences at the last space before max with an ellipsis", () => {
    const out = firstSentence("alpha beta gamma delta epsilon", 14);
    expect(out).toBe("alpha beta…");
  });
  it("returns empty string for empty input", () => {
    expect(firstSentence("")).toBe("");
  });
});

describe("matchesQuery", () => {
  it("matches everything for an empty or blank query", () => {
    expect(matchesQuery("", "x")).toBe(true);
    expect(matchesQuery("   ", null)).toBe(true);
  });
  it("matches a single token case-insensitively", () => {
    expect(matchesQuery("TEMPLE", "The second temple")).toBe(true);
  });
  it("requires every token, possibly across fields", () => {
    expect(matchesQuery("exile babylon", "The exile", "in Babylon")).toBe(true);
    expect(matchesQuery("exile rome", "The exile", "in Babylon")).toBe(false);
  });
  it("strips diacritics", () => {
        expect(matchesQuery("Nehemía", "Nehemiah")).toBe(true);
  });
  it("ignores null and undefined fields", () => {
    expect(matchesQuery("ezra", null, undefined, "Ezra")).toBe(true);
    expect(matchesQuery("ezra", null, undefined)).toBe(false);
  });
});

describe("eraWithMostEvents", () => {
  it("returns the era id holding the most events by earliest year", () => {
    expect(eraWithMostEvents(eras, [{ earliest: -550 }, { earliest: -520 }, { earliest: -950 }])).toBe("c");
  });
  it("breaks ties toward the earlier era", () => {
    expect(eraWithMostEvents(eras, [{ earliest: -550 }, { earliest: -750 }])).toBe("b");
  });
  it("returns null when no event lands in an era", () => {
    expect(eraWithMostEvents(eras, [{ earliest: -850 }])).toBeNull();
    expect(eraWithMostEvents(eras, [])).toBeNull();
  });
});

describe("groupByBook", () => {
  it("sorts sections by book number with a trailing 'No verse yet'", () => {
    const items = [
      { n: "a", b: 40 as number | null },
      { n: "b", b: null },
      { n: "c", b: 1 },
      { n: "d", b: 40 },
    ];
    const sections = groupByBook(items, (i) => i.b, (b) => `Book ${b}`);
    expect(sections.map((s) => s.book)).toEqual([1, 40, null]);
    expect(sections.map((s) => s.name)).toEqual(["Book 1", "Book 40", "No verse yet"]);
    expect(sections[1].items.map((i) => i.n)).toEqual(["a", "d"]);
  });
  it("omits the trailing section when every item has a book", () => {
    expect(groupByBook([{ b: 2 }], (i) => i.b, String).map((s) => s.book)).toEqual([2]);
  });
});

describe("sortByYear", () => {
  it("sorts ascending, stably, with nulls last", () => {
    const items = [
      { n: "a", y: 5 as number | null },
      { n: "b", y: null },
      { n: "c", y: -3 },
      { n: "d", y: 5 },
      { n: "e", y: null },
    ];
    expect(sortByYear(items, (i) => i.y).map((i) => i.n)).toEqual(["c", "a", "d", "b", "e"]);
  });
});
