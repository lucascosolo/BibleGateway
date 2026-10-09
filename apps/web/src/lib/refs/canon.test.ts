import { describe, expect, it } from "vitest";

import { BookIndex, type BookRecord, canonOf } from "./book-index";
import { InvalidReferenceError } from "./verse-id";

const index = new BookIndex([
  { bookId: 1, osisId: "Gen", name: "Genesis", abbreviation: "Gen", testament: "OT", chapterCount: 50 },
  { bookId: 43, osisId: "John", name: "John", abbreviation: "Jn", testament: "NT", chapterCount: 21 },
  { bookId: 101, osisId: "GThom", name: "Gospel of Thomas", abbreviation: "Gos. Thom.", testament: "DC", chapterCount: 1, canon: "nt-apocrypha", numbering: "logion" },
  { bookId: 85, osisId: "1En", name: "1 Enoch", abbreviation: "1 En", testament: "DC", chapterCount: 108, canon: "pseudepigrapha", numbering: "chapter-verse" },
] satisfies BookRecord[]);

describe("canonOf", () => {
  it("is hebrew for books 1-39 without a canon field", () => {
    expect(canonOf(1, index)).toBe("hebrew");
    expect(canonOf(39, index)).toBe("hebrew");
  });
  it("is nt for books 40-66 without a canon field", () => {
    expect(canonOf(40, index)).toBe("nt");
    expect(canonOf(43, index)).toBe("nt");
    expect(canonOf(66, index)).toBe("nt");
  });
  it("returns the record's canon for 67+", () => {
    expect(canonOf(101, index)).toBe("nt-apocrypha");
    expect(canonOf(85, index)).toBe("pseudepigrapha");
  });
  it("throws for an unknown outside id", () => {
    expect(() => canonOf(999, index)).toThrow(InvalidReferenceError);
  });
});
