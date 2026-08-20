import { describe, expect, it } from "vitest";

import { groupBooksForBrowse, type BookBrowseEntry } from "./bookGroups";

const gen: BookBrowseEntry = {
  bookId: 1,
  osisId: "Gen",
  name: "Genesis",
  testament: "OT",
  genres: ["law", "narrative"],
  chapterCount: 50,
};
const lev: BookBrowseEntry = {
  bookId: 3,
  osisId: "Lev",
  name: "Leviticus",
  testament: "OT",
  genres: ["law"],
  chapterCount: 27,
};
const ps: BookBrowseEntry = {
  bookId: 19,
  osisId: "Ps",
  name: "Psalms",
  testament: "OT",
  genres: ["poetry"],
  chapterCount: 150,
};
const john: BookBrowseEntry = {
  bookId: 43,
  osisId: "John",
  name: "John",
  testament: "NT",
  genres: ["narrative"],
  chapterCount: 21,
};
const rom: BookBrowseEntry = {
  bookId: 45,
  osisId: "Rom",
  name: "Romans",
  testament: "NT",
  genres: ["epistle"],
  chapterCount: 16,
};

describe("groupBooksForBrowse", () => {
  it("separates testaments, and orders OT before NT regardless of input order", () => {
    const groups = groupBooksForBrowse([rom, gen]);
    expect(groups.map((g) => g.testament)).toEqual(["OT", "NT"]);
  });

  it("orders genres canonically within a testament, not alphabetically", () => {
    const groups = groupBooksForBrowse([ps, lev, gen]);
    const otGenres = groups.find((g) => g.testament === "OT")!.genres.map((g) => g.genre);
    expect(otGenres).toEqual(["law", "poetry"]);
  });

  it("files a multi-genre book under its primary genre only", () => {
    // Genesis carries ["law", "narrative"]. A browse index names each book once; listing it
    // under both reads as a duplicate rather than as faceting.
    const groups = groupBooksForBrowse([gen]);
    const ot = groups.find((g) => g.testament === "OT")!;
    expect(ot.genres.map((g) => g.genre)).toEqual(["law"]);
    expect(ot.genres[0].books.map((b) => b.osisId)).toEqual(["Gen"]);
  });

  it("keeps every book exactly once across all groups", () => {
    const groups = groupBooksForBrowse([gen, lev, ps, john, rom]);
    const listed = groups.flatMap((t) => t.genres.flatMap((g) => g.books.map((b) => b.osisId)));
    expect(listed.length).toBe(5);
    expect(new Set(listed).size).toBe(5);
  });

  it("keeps the secondary genres on the entry for later filtering", () => {
    const groups = groupBooksForBrowse([gen]);
    expect(groups[0].genres[0].books[0].genres).toEqual(["law", "narrative"]);
  });

  it("omits testaments with no entries rather than emitting an empty group", () => {
    const groups = groupBooksForBrowse([john]);
    expect(groups.map((g) => g.testament)).toEqual(["NT"]);
  });

  it("returns an empty list for no input", () => {
    expect(groupBooksForBrowse([])).toEqual([]);
  });
});
