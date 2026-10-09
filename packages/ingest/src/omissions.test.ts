import { describe, expect, it } from "vitest";
import { omissionExplanation, TRANSLATION_SOURCES } from "./translations";
const lxx = TRANSLATION_SOURCES.find((t) => t.code === "LXX")!;
const bsb = TRANSLATION_SOURCES.find((t) => t.code === "BSB")!;
describe("omissionExplanation", () => {
  it("labels a Septuagint numbering gap as versification, never as a Greek NT omission", () => {
    const e = omissionExplanation(lxx, 16_004_006); // Nehemiah 4:6
    expect(e.kind).toBe("versification");
    expect(e.reason).not.toMatch(/New Testament|Greek copies/);
    expect(e.reason).toMatch(/Septuagint|numbering/);
  });
  it("labels a known critical-text verse with its history", () => {
    const e = omissionExplanation(bsb, 40_017_021); // Matthew 17:21
    expect(e.kind).toBe("critical-text");
    expect(e.history).toMatch(/Matthew 17:21|Mark 9:29/);
  });
  it("marks any other gap unexplained with neutral wording", () => {
    const e = omissionExplanation(bsb, 1_001_031);
    expect(e.kind).toBe("unexplained");
    expect(e.reason).toMatch(/not printed|no explanation/i);
    expect(e.reason).not.toMatch(/manuscript/);
  });
});
