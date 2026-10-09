import { describe, expect, it } from "vitest";

import { DEFAULT_CANON_FILTER, parseCanonFilter } from "./query";

describe("parseCanonFilter", () => {
  it("defaults to bible", () => {
    expect(DEFAULT_CANON_FILTER).toBe("bible");
  });
  it.each(["all", "ALL", "All"])("%s -> all", (raw) => {
    expect(parseCanonFilter(raw)).toBe("all");
  });
  it.each([null, undefined, "", "bible", "outside", "garbage"])("%s -> bible", (raw) => {
    expect(parseCanonFilter(raw as string | null | undefined)).toBe("bible");
  });
});
