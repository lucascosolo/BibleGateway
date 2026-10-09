import { describe, expect, it } from "vitest";

import { translationForOutsideBook } from "./outside";

describe("translationForOutsideBook", () => {
  const carriers = ["MATTISON", "KJVA"];
  it("keeps a requested edition that carries the book, in any case", () => {
    expect(translationForOutsideBook("kjva", carriers)).toBe("kjva");
  });
  it("falls back to the first carrier when the requested edition does not carry it", () => {
    expect(translationForOutsideBook("KJV", carriers)).toBe("MATTISON");
  });
  it("uses the first carrier when none is requested", () => {
    expect(translationForOutsideBook(undefined, carriers)).toBe("MATTISON");
  });
  it("is null for a book no edition carries", () => {
    expect(translationForOutsideBook("KJV", [])).toBeNull();
  });
});
