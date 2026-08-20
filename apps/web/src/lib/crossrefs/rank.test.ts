import { describe, expect, it } from "vitest";
import { BookIndex, type BookRecord } from "@/lib/refs/book-index";
import { toVerseId } from "@/lib/refs/verse-id";
import { groupByTargetBook, sortByVotes } from "./rank";
import type { ResolvedXref } from "./types";

const BOOKS: BookRecord[] = [
  { bookId: 19, osisId: "Ps", name: "Psalms", abbreviation: "Ps", testament: "OT", chapterCount: 150 },
  { bookId: 23, osisId: "Isa", name: "Isaiah", abbreviation: "Isa", testament: "OT", chapterCount: 66 },
  { bookId: 43, osisId: "John", name: "John", abbreviation: "Jn", testament: "NT", chapterCount: 21 },
];
const books = new BookIndex(BOOKS);

function xref(book: number, chapter: number, verse: number, votes: number): ResolvedXref {
  const id = toVerseId(book, chapter, verse);
  return {
    range: { start: id, end: id },
    reference: `book${book} ${chapter}:${verse}`,
    slug: `book${book}.${chapter}.${verse}`,
    votes,
    tier: votes >= 20 ? "strong" : votes >= 5 ? "moderate" : "light",
    source: "openbible",
    preview: null,
  };
}

describe("sortByVotes", () => {
  it("orders strongest first, breaking ties by canonical position", () => {
    const items = [xref(43, 3, 16, 10), xref(19, 22, 1, 30), xref(23, 53, 5, 30)];
    const sorted = sortByVotes(items);
    expect(sorted.map((i) => i.votes)).toEqual([30, 30, 10]);
    // Tie between Isa 53:5 and Ps 22:1 (both 30 votes) breaks by verse id — Psalms (book 19)
    // sorts before Isaiah (book 23).
    expect(sorted[0].reference).toBe("book19 22:1");
  });
});

describe("groupByTargetBook", () => {
  it("buckets by the target's book and ranks groups by their strongest item", () => {
    const items = [
      xref(23, 53, 5, 40), // Isaiah, strong
      xref(23, 7, 14, 3), // Isaiah, light
      xref(19, 22, 1, 15), // Psalms, moderate
    ];
    const groups = groupByTargetBook(items, books);

    expect(groups.map((g) => g.bookName)).toEqual(["Isaiah", "Psalms"]);
    expect(groups[0].topVotes).toBe(40);
    expect(groups[0].items.map((i) => i.votes)).toEqual([40, 3]); // ranked within the group too
  });

  it("returns nothing for an empty input", () => {
    expect(groupByTargetBook([], books)).toEqual([]);
  });
});
