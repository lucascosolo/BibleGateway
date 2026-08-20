import { describe, expect, it } from "vitest";

import { BookIndex, type BookRecord } from "./book-index";
import { classifyQuery } from "./classify";

const BOOKS: BookRecord[] = [
  { bookId: 1, osisId: "Gen", name: "Genesis", abbreviation: "Gen", testament: "OT", chapterCount: 50 },
  { bookId: 19, osisId: "Ps", name: "Psalms", abbreviation: "Ps", testament: "OT", chapterCount: 150 },
  { bookId: 43, osisId: "John", name: "John", abbreviation: "Jn", testament: "NT", chapterCount: 21 },
  { bookId: 45, osisId: "Rom", name: "Romans", abbreviation: "Rom", testament: "NT", chapterCount: 16 },
];

const books = new BookIndex(BOOKS);

describe("classifyQuery", () => {
  it("classifies blank input as empty", () => {
    expect(classifyQuery("", books)).toEqual({ type: "empty" });
    expect(classifyQuery("   ", books)).toEqual({ type: "empty" });
  });

  it("classifies a parseable reference and links to its reader slug", () => {
    expect(classifyQuery("John 3:16", books)).toEqual({
      type: "reference",
      slug: "John.3.16",
      label: "John 3:16",
    });
  });

  it("classifies a whole-chapter reference", () => {
    expect(classifyQuery("Rom 8", books)).toEqual({
      type: "reference",
      slug: "Rom.8.1-999",
      // The label is what gets shown back to the user as "we read that as…", so it expands
      // the abbreviation the user typed into the book's full name — that expansion is the
      // confirmation. The slug keeps the OSIS abbreviation; only the label is spelled out.
      label: "Romans 8",
    });
  });

  it("classifies OSIS-form input as a reference", () => {
    expect(classifyQuery("Ps.23.1", books)).toEqual({
      type: "reference",
      slug: "Ps.23.1",
      label: "Psalms 23:1",
    });
  });

  it("falls back to search for anything that does not parse as a reference", () => {
    expect(classifyQuery("love your neighbor", books)).toEqual({
      type: "search",
      query: "love your neighbor",
    });
  });

  it("falls back to search for a book name with an out-of-range chapter", () => {
    expect(classifyQuery("John 99:1", books)).toEqual({
      type: "search",
      query: "John 99:1",
    });
  });

  it("trims surrounding whitespace before classifying", () => {
    expect(classifyQuery("  John 3:16  ", books)).toEqual({
      type: "reference",
      slug: "John.3.16",
      label: "John 3:16",
    });
  });
});
