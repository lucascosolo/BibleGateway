import { describe, expect, it } from "vitest";

import type { VerseId } from "@/lib/refs/verse-id";
import { nextRate, nextVerse, prevVerse, startOf, startVerse, verseAt, type VerseTiming } from "./timing";

const v = (n: number) => (1_001_000 + n) as VerseId;
const timings: VerseTiming[] = [
  { verseId: v(1), startMs: 1000, endMs: 4000 },
  { verseId: v(2), startMs: 4500, endMs: 8000 },
  // Verse 3 is not placed by the recording (a gap in coverage); verse 4 follows.
  { verseId: v(4), startMs: 9000, endMs: 12000 },
];

describe("verseAt", () => {
  it("is null before the first verse starts (the narrator's introduction)", () => {
    expect(verseAt(timings, 0)).toBeNull();
    expect(verseAt(timings, 999)).toBeNull();
  });
  it("finds the verse whose window contains the time", () => {
    expect(verseAt(timings, 1000)).toBe(v(1));
    expect(verseAt(timings, 3999)).toBe(v(1));
    expect(verseAt(timings, 5000)).toBe(v(2));
    expect(verseAt(timings, 11000)).toBe(v(4));
  });
  it("holds the last-started verse across a pause between verses", () => {
    expect(verseAt(timings, 4200)).toBe(v(1));
    expect(verseAt(timings, 8500)).toBe(v(2));
  });
  it("keeps the last verse after the end of the file", () => {
    expect(verseAt(timings, 60_000)).toBe(v(4));
  });
  it("handles an empty timing list", () => {
    expect(verseAt([], 5)).toBeNull();
  });
});

describe("startOf / nextVerse / prevVerse", () => {
  it("looks up a placed verse and reports an unplaced one as null", () => {
    expect(startOf(timings, v(2))).toBe(4500);
    expect(startOf(timings, v(3))).toBeNull();
  });
  it("steps through the recording's own verse order, skipping gaps", () => {
    expect(nextVerse(timings, v(2))).toBe(v(4));
    expect(nextVerse(timings, v(4))).toBeNull();
    expect(prevVerse(timings, v(4))).toBe(v(2));
    expect(prevVerse(timings, v(1))).toBeNull();
    expect(nextVerse(timings, v(3))).toBeNull();
  });
});

describe("startVerse", () => {
  const rendered = [v(2), v(3), v(4)];
  it("prefers the requested verse when the recording places it", () => {
    expect(startVerse(timings, v(4), rendered)).toBe(v(4));
  });
  it("falls back to the first rendered verse that is placed", () => {
    expect(startVerse(timings, null, rendered)).toBe(v(2));
    expect(startVerse(timings, v(3), rendered)).toBe(v(2));
  });
  it("skips rendered verses the recording does not place", () => {
    expect(startVerse(timings, null, [v(3), v(4)])).toBe(v(4));
  });
  it("is null when nothing rendered has audio", () => {
    expect(startVerse(timings, null, [v(3)])).toBeNull();
    expect(startVerse([], null, rendered)).toBeNull();
  });
});

describe("nextRate", () => {
  it("cycles through the offered speeds and wraps", () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(2)).toBe(0.8);
  });
  it("recovers from a rate that is not in the list", () => {
    expect(nextRate(3)).toBe(0.8);
  });
});
