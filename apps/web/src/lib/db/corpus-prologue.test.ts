// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("getAllBooks hasPrologue (real corpus)", () => {
  it.skipIf(!process.env.BIBLE_DB_PATH)("is a boolean, true exactly for the prologue books", async () => {
    const { getAllBooks } = await import("./corpus");
    const books = getAllBooks();
    for (const b of books) expect([b.bookId, typeof b.hasPrologue]).toEqual([b.bookId, "boolean"]);
    expect(books.filter((b) => b.hasPrologue).map((b) => b.bookId)).toEqual([71, 86, 101, 111, 112, 113, 114, 115, 116, 117, 118]);
  });
});
