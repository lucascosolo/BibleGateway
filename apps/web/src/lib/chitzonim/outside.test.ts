import { describe, expect, it } from "vitest";

import {
  FIRST_OUTSIDE_BOOK,
  OUTSIDE_AREAS,
  canonNotice,
  carryingTranslations,
  composedLabel,
  parallelPair,
  getArea,
  isOutsideBook,
  numberingLabel,
  numberingRangeLabel,
} from "./outside";

describe("OUTSIDE_AREAS", () => {
  it("has exactly five areas in order, all fully described", () => {
    expect(OUTSIDE_AREAS.map((a) => a.key)).toEqual([
      "deuterocanon", "pseudepigrapha", "nt-apocrypha", "apostolic", "described",
    ]);
    for (const a of OUTSIDE_AREAS) {
      expect(a.title).not.toBe("");
      expect(a.summary).not.toBe("");
      expect(a.readBy).not.toBe("");
    }
  });
  it("getArea finds by key and returns undefined otherwise", () => {
    expect(getArea("apostolic")?.key).toBe("apostolic");
    expect(getArea("nope")).toBeUndefined();
  });
});

describe("isOutsideBook", () => {
  it("starts at 67", () => {
    expect(FIRST_OUTSIDE_BOOK).toBe(67);
    for (const id of [67, 101, 120]) expect(isOutsideBook(id)).toBe(true);
    for (const id of [1, 43, 66]) expect(isOutsideBook(id)).toBe(false);
  });
});

describe("canonNotice", () => {
  it("is null for canonical or unknown canons", () => {
    expect(canonNotice("hebrew", [])).toBeNull();
    expect(canonNotice("nt", [])).toBeNull();
    expect(canonNotice(undefined, [])).toBeNull();
  });
  it.each(["deuterocanon", "pseudepigrapha", "nt-apocrypha", "apostolic"])("%s with no holders starts 'Outside the'", (c) => {
    expect(canonNotice(c, [])).toMatch(/^Outside the/);
  });
  it("names the holder and lists all three omitting bibles", () => {
    const n = canonNotice("pseudepigrapha", ["Ethiopian Orthodox Tewahedo Church"])!;
    expect(n.startsWith("Outside the canon")).toBe(true);
    expect(n).toContain("read in");
    expect(n).toContain("Ethiopian Orthodox Tewahedo Church");
    expect(n).toContain("not in Jewish, Catholic or Protestant Bibles");
  });
  it("drops a bible tradition whose name appears in a holder", () => {
    const n = canonNotice("deuterocanon", ["Catholic Church", "Eastern Orthodox churches"])!;
    expect(n).toContain("Catholic Church");
    expect(n).toContain("not in Jewish or Protestant Bibles");
    expect(n).not.toContain("not in Jewish, Catholic");
  });
});

describe("numberingLabel", () => {
  it.each([
    ["logion", "GThom", 1, 42, "logion 42"],
    ["logion", "GThom", 1, 0, "prologue"],
    ["section", "GPet", 1, 5, "section 5"],
    ["chapter", "Did", 3, 1, "chapter 3"],
    ["page", "GJudas", 33, 2, "page 33"],
    ["paragraph", "PlThec", 2, 7, "chapter 2, paragraph 7"],
    ["part-chapter", "Herm", 104, 1, "Mandate 4"],
    ["part-chapter", "Herm", 3, 1, "Vision 3"],
    ["part-chapter", "Herm", 209, 1, "Parable 9"],
    ["part-chapter", "InfThom", 103, 1, "Greek B, chapter 3"],
    ["chapter-verse", "Sir", 1, 0, "prologue"],
    ["chapter-verse", "1En", 5, 3, "chapter 5"],
  ])("%s %s %i:%i -> %s", (num, osis, ch, v, want) => {
    expect(numberingLabel(num, osis, ch, v)).toBe(want);
  });
});

describe("numberingRangeLabel", () => {
  it("joins differing ends with 'to'", () => {
    expect(numberingRangeLabel("logion", "GThom", { chapter: 1, verse: 1 }, { chapter: 1, verse: 12 })).toBe("logion 1 to logion 12");
  });
  it("collapses identical labels", () => {
    expect(numberingRangeLabel("chapter", "Did", { chapter: 3, verse: 1 }, { chapter: 3, verse: 1 })).toBe("chapter 3");
  });
});

describe("carryingTranslations", () => {
  it("keeps only carriers, case-insensitively, in the order of `all`", () => {
    const all = ["WEB", "KJV", "LXX", "KJVA", "MATTISON"].map((code) => ({ code }));
    expect(carryingTranslations(all, ["kjva", "LXX"]).map((t) => t.code)).toEqual(["LXX", "KJVA"]);
  });
});

describe("parallelPair", () => {
  const code = (t?: { code: string }) => t?.code;
  const sirach = ["LXX", "KJVA"].map((c) => ({ code: c }));
  const bible = ["WEB", "BSB", "KJV"].map((c) => ({ code: c }));

  it("defaults to two carrying editions when two exist", () => {
    const { left, right } = parallelPair(sirach);
    expect([code(left), code(right)]).toEqual(["LXX", "KJVA"]);
  });
  it("never picks an edition that does not carry the book, even when asked", () => {
    const { left, right } = parallelPair(sirach, "WEB", "BSB");
    expect([code(left), code(right)]).toEqual(["LXX", "KJVA"]);
  });
  it("leaves the right side empty when only one edition carries the book", () => {
    const { left, right } = parallelPair([{ code: "MATTISON" }]);
    expect(code(left)).toBe("MATTISON");
    expect(right).toBeUndefined();
  });
  it("keeps WEB and BSB as the default pair for the 66", () => {
    expect(parallelPair(bible).left?.code).toBe("WEB");
    expect(parallelPair(bible).right?.code).toBe("BSB");
    expect(parallelPair(bible, "BSB").right?.code).toBe("WEB");
  });
  it("honours an explicit identical pair so the page can ask for two different ones", () => {
    const { left, right } = parallelPair(bible, "KJV", "KJV");
    expect(left).toBe(right);
  });
});

describe("composedLabel", () => {
  it("prints the source's own label when the span is one year", () => {
    expect(composedLabel(170, 170, "About 170 CE")).toBe("About 170 CE");
  });
  it("prints a range as a range", () => {
    expect(composedLabel(-200, -175, "Early second century BCE")).toBe("200–175 BCE");
  });
});
