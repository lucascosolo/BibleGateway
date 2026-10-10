// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("getAdjacentChapters (real corpus)", () => {
  it.skipIf(!process.env.BIBLE_DB_PATH).each([
    [1, 1, { prev: null, next: 2 }],
    [1, 50, { prev: 49, next: null }],
    [69, 10, { prev: null, next: 11 }],
    [69, 16, { prev: 15, next: null }],
    [67, 1, { prev: null, next: 2 }],
  ])("book %i chapter %i", async (book, chapter, expected) => {
    const { getAdjacentChapters } = await import("./corpus");
    expect(getAdjacentChapters(book, chapter)).toEqual(expected);
  });

  it.skipIf(!process.env.BIBLE_DB_PATH)("outside book index carries lastChapter", async () => {
    const { getOutsideBookIndex } = await import("./corpus");
    const idx = getOutsideBookIndex();
    expect(idx.get(69)?.lastChapter).toBe(16);
    expect(idx.get(1)?.lastChapter).toBe(50);
  });
});
