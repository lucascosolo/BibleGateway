import { describe, expect, it } from "vitest";
import { TIER_META, xrefTier } from "./tiers";

describe("xrefTier", () => {
  it("classifies strong references (>=20 votes)", () => {
    expect(xrefTier(20)).toBe("strong");
    expect(xrefTier(500)).toBe("strong");
  });

  it("classifies moderate references (5-19 votes)", () => {
    expect(xrefTier(5)).toBe("moderate");
    expect(xrefTier(19)).toBe("moderate");
  });

  it("classifies light references (<5 votes)", () => {
    expect(xrefTier(4)).toBe("light");
    expect(xrefTier(0)).toBe("light");
  });

  it("has display metadata for every tier it can produce", () => {
    for (const votes of [0, 1, 4, 5, 10, 19, 20, 100]) {
      expect(TIER_META[xrefTier(votes)]).toBeDefined();
    }
  });
});
