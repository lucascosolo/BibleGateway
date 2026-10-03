import { describe, expect, it } from "vitest";
import { parseRange } from "@/lib/audio/http";

describe("parseRange", () => {
  it("returns null with no header or a malformed one", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("chars=0-1", 100)).toBeNull();
    expect(parseRange("bytes=-", 100)).toBeNull();
    expect(parseRange("bytes=1-2,5-6", 100)).toBeNull();
  });
  it("parses a closed range and clamps the end to the file", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual([0, 9]);
    expect(parseRange("bytes=90-500", 100)).toEqual([90, 99]);
  });
  it("parses an open-ended range (what a seek sends)", () => {
    expect(parseRange("bytes=40-", 100)).toEqual([40, 99]);
  });
  it("parses a suffix range", () => {
    expect(parseRange("bytes=-10", 100)).toEqual([90, 99]);
    expect(parseRange("bytes=-500", 100)).toEqual([0, 99]);
    expect(parseRange("bytes=-0", 100)).toBeNull();
  });
  it("rejects a range that starts past the end", () => {
    expect(parseRange("bytes=100-", 100)).toBeNull();
    expect(parseRange("bytes=50-40", 100)).toBeNull();
  });
});
