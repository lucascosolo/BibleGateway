import { describe, expect, it } from "vitest";
import { formatYear, formatRange, spanYears, overlaps } from "@/lib/timeline/years";

describe("formatYear", () => {
  it("renders BCE and CE with no year zero", () => {
    expect(formatYear(-586)).toBe("586 BCE");
    expect(formatYear(33)).toBe("33 CE");
    expect(formatYear(-1)).toBe("1 BCE");
    expect(formatYear(1)).toBe("1 CE");
  });
});

describe("formatRange", () => {
  it("shares the era suffix within one era", () => {
    expect(formatRange(-1446, -1406)).toBe("1446–1406 BCE");
  });
  it("names both eras when crossing", () => {
    expect(formatRange(-4, 30)).toBe("4 BCE–30 CE");
  });
  it("collapses a single-year range", () => {
    expect(formatRange(-701, -701)).toBe("701 BCE");
  });
});

describe("spanYears (year boundaries crossed, skipping zero)", () => {
  it("counts across the BCE/CE boundary", () => {
    expect(spanYears(-1, 1)).toBe(1);
    expect(spanYears(-587, -586)).toBe(1);
    expect(spanYears(1, 2)).toBe(1);
    expect(spanYears(-4, 30)).toBe(33);
  });
});

describe("overlaps (inclusive)", () => {
  it("is true when ranges share an endpoint or nest", () => {
    expect(overlaps(-10, -5, -5, 3)).toBe(true);
    expect(overlaps(-10, 10, -2, 2)).toBe(true);
  });
  it("is false when disjoint", () => {
    expect(overlaps(-10, -6, -5, 3)).toBe(false);
    expect(overlaps(5, 9, -5, 4)).toBe(false);
  });
});

describe("year zero", () => {
  it("throws RangeError everywhere", () => {
    expect(() => formatYear(0)).toThrow(RangeError);
    expect(() => formatRange(0, 5)).toThrow(RangeError);
    expect(() => formatRange(-5, 0)).toThrow(RangeError);
    expect(() => spanYears(0, 5)).toThrow(RangeError);
    expect(() => overlaps(0, 5, 1, 2)).toThrow(RangeError);
    expect(() => overlaps(1, 2, -3, 0)).toThrow(RangeError);
  });
});
