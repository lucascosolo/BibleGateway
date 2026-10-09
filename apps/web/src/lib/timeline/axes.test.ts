import { describe, expect, it } from "vitest";

import { AXES, AXIS_DATE_LABEL } from "./axes";

describe("AXIS_DATE_LABEL", () => {
  it("has a label for every axis", () => {
    for (const axis of AXES) expect(typeof AXIS_DATE_LABEL[axis]).toBe("string");
  });
  it("uses the exact strings", () => {
    expect(AXIS_DATE_LABEL).toEqual({
      narrative: "When it happened",
      composition: "When it was written",
      canon: "When this list or judgement was made",
    });
  });
  it("never claims anything 'became scripture'", () => {
    for (const axis of AXES) expect(AXIS_DATE_LABEL[axis]).not.toContain("became scripture");
  });
});
