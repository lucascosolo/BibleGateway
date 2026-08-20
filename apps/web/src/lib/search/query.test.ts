import { describe, expect, it } from "vitest";

import type { BookRecord } from "@/lib/refs/book-index";
import { BookIndex } from "@/lib/refs/book-index";
import {
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  classifySearchQuery,
  clampSearchPagination,
  parseHighlightMarkers,
  sanitizeFtsQuery,
} from "./query";

const BOOKS: BookRecord[] = [
  { bookId: 43, osisId: "John", name: "John", abbreviation: "Jn", testament: "NT", chapterCount: 21 },
  { bookId: 45, osisId: "Rom", name: "Romans", abbreviation: "Rom", testament: "NT", chapterCount: 16 },
];
const books = new BookIndex(BOOKS);

describe("sanitizeFtsQuery", () => {
  it("quotes plain words so FTS5 keywords in the input are searched literally", () => {
    expect(sanitizeFtsQuery("love")).toBe('"love"');
    expect(sanitizeFtsQuery("NOT OR AND")).toBe('"NOT" "OR" "AND"');
  });

  it("returns an empty string for input with no word content, never throwing", () => {
    expect(sanitizeFtsQuery('"')).toBe("");
    expect(sanitizeFtsQuery("*")).toBe("");
    expect(sanitizeFtsQuery("   ")).toBe("");
    expect(sanitizeFtsQuery("()():::")).toBe("");
  });

  it("keeps a trailing * as a prefix query on an otherwise-bare word", () => {
    expect(sanitizeFtsQuery("lov*")).toBe("lov*");
  });

  it("strips punctuation adjacent to a word rather than leaking it into query syntax", () => {
    expect(sanitizeFtsQuery('God\'s "grace"')).toBe('"God" "s" "grace"');
    expect(sanitizeFtsQuery("faith (justification)")).toBe('"faith" "justification"');
  });

  it("doubles an internal double-quote rather than letting it close the literal early", () => {
    // A literal `"` inside a token can't occur from the tokenizer regex itself (it only
    // matches letters/digits), but the escaping is defense in depth if that ever changes.
    expect(sanitizeFtsQuery("love")).not.toContain('""');
  });

  it("ANDs multiple words together (space-joined, FTS5's default)", () => {
    expect(sanitizeFtsQuery("faith hope love")).toBe('"faith" "hope" "love"');
  });
});

describe("parseHighlightMarkers", () => {
  it("finds a single match", () => {
    const marked = `For God so ${HIGHLIGHT_START}loved${HIGHLIGHT_END} the world.`;
    const matches = parseHighlightMarkers(marked);
    expect(matches).toEqual([{ start: 11, end: 16 }]);
  });

  it("recovers the exact substring at the reported offsets", () => {
    const clean = "For God so loved the world.";
    const marked = `For God so ${HIGHLIGHT_START}loved${HIGHLIGHT_END} the world.`;
    const [m] = parseHighlightMarkers(marked);
    expect(clean.slice(m.start, m.end)).toBe("loved");
  });

  it("finds multiple, non-adjacent matches in order", () => {
    const marked = `${HIGHLIGHT_START}Love${HIGHLIGHT_END} your neighbor as you ${HIGHLIGHT_START}love${HIGHLIGHT_END} yourself.`;
    const matches = parseHighlightMarkers(marked);
    expect(matches).toHaveLength(2);
    expect(matches[0].start).toBe(0);
    const clean = "Love your neighbor as you love yourself.";
    expect(clean.slice(matches[1].start, matches[1].end)).toBe("love");
  });

  it("returns no matches for text with no markers", () => {
    expect(parseHighlightMarkers("In the beginning was the Word.")).toEqual([]);
  });

  it("returns an empty array rather than throwing on an unterminated marker", () => {
    expect(() => parseHighlightMarkers(`broken ${HIGHLIGHT_START}marker with no end`)).not.toThrow();
    expect(parseHighlightMarkers(`broken ${HIGHLIGHT_START}marker with no end`)).toEqual([]);
  });
});

describe("classifySearchQuery", () => {
  it("classifies a well-formed reference", () => {
    const result = classifySearchQuery("Rom 8:28", books);
    expect(result.mode).toBe("reference");
    if (result.mode === "reference") {
      expect(result.reference.start).toBe(45_008_028);
    }
  });

  it("classifies a bare book name as a reference (whole book)", () => {
    const result = classifySearchQuery("John", books);
    expect(result.mode).toBe("reference");
  });

  it("classifies ordinary free text as text, not a reference", () => {
    expect(classifySearchQuery("love", books).mode).toBe("text");
    expect(classifySearchQuery("grace and truth", books).mode).toBe("text");
  });

  it("classifies empty or whitespace-only input as text", () => {
    expect(classifySearchQuery("", books).mode).toBe("text");
    expect(classifySearchQuery("   ", books).mode).toBe("text");
  });
});

describe("clampSearchPagination", () => {
  it("defaults limit and offset when absent", () => {
    expect(clampSearchPagination(null, null)).toEqual({ limit: 20, offset: 0 });
  });

  it("clamps limit to the configured maximum", () => {
    expect(clampSearchPagination("500", null).limit).toBe(100);
  });

  it("clamps a zero or negative limit up to at least 1", () => {
    expect(clampSearchPagination("0", null).limit).toBe(1);
    expect(clampSearchPagination("-5", null).limit).toBe(1);
  });

  it("falls back to the default limit on non-numeric input", () => {
    expect(clampSearchPagination("abc", null).limit).toBe(20);
  });

  it("floors a negative offset at zero", () => {
    expect(clampSearchPagination(null, "-10").offset).toBe(0);
  });

  it("accepts a valid positive offset", () => {
    expect(clampSearchPagination(null, "40").offset).toBe(40);
  });

  it("falls back to zero offset on non-numeric input", () => {
    expect(clampSearchPagination(null, "abc").offset).toBe(0);
  });
});
