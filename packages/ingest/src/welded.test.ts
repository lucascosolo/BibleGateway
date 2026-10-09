import { describe, expect, it } from "vitest";
import {
  WEB_WELDED_VERSES,
  splitWeldedVerse,
  unexplainedOmissionErrors,
} from "./translations";

const REAL =
  "But he who doubts is condemned if he eats, because it isn’t of faith; and whatever is not of faith is sin.     Now to him who is able to establish you according to my Good News and the preaching of Jesus Christ, according to the revelation of the mystery which has been kept secret through long ages, but now is revealed, and by the Scriptures of the prophets, according to the commandment of the eternal God, is made known for obedience of faith to all the nations; to the only wise God, through Jesus Christ, to whom be the glory forever! Amen.   ";

const w = WEB_WELDED_VERSES[0];

describe("WEB_WELDED_VERSES", () => {
  it("declares exactly the Romans 14:23 weld with its three doxology anchors", () => {
    expect(WEB_WELDED_VERSES).toHaveLength(1);
    expect(w.bookId).toBe(45);
    expect(w.chapter).toBe(14);
    expect(w.verse).toBe(23);
    expect(w.parts).toEqual([
      { anchor: "Now to him who is able to establish you", chapter: 16, verse: 25 },
      { anchor: "but now is revealed", chapter: 16, verse: 26 },
      { anchor: "to the only wise God", chapter: 16, verse: 27 },
    ]);
    expect(w.note.length).toBeGreaterThan(0);
    expect(w.note).toContain("14:23");
  });
});

describe("splitWeldedVerse", () => {
  const pieces = () => splitWeldedVerse(REAL, w);

  it("returns four pieces at 14:23, 16:25, 16:26, 16:27", () => {
    expect(pieces().map((p) => `${p.chapter}:${p.verse}`)).toEqual([
      "14:23",
      "16:25",
      "16:26",
      "16:27",
    ]);
  });

  it("cuts each piece at the right words", () => {
    const p = pieces();
    expect(p[0].text.trim().endsWith("is sin.")).toBe(true);
    expect(p[1].text.startsWith("Now to him")).toBe(true);
    expect(p[1].text.trim().endsWith("long ages,")).toBe(true);
    expect(p[2].text.startsWith("but now is revealed")).toBe(true);
    expect(p[3].text.trim()).toBe(
      "to the only wise God, through Jesus Christ, to whom be the glory forever! Amen.",
    );
  });

  it("slices raw so the pieces concatenate back to the input", () => {
    expect(pieces().map((p) => p.text).join("")).toBe(REAL);
  });

  it("throws when an anchor is absent", () => {
    expect(() => splitWeldedVerse(REAL.replace("but now is revealed", "but now shown"), w)).toThrow();
  });

  it("throws when an anchor appears twice", () => {
    expect(() => splitWeldedVerse(REAL + " to the only wise God", w)).toThrow();
  });

  it("throws when anchors are out of order", () => {
    const reversed = { ...w, parts: [...w.parts].reverse() };
    expect(() => splitWeldedVerse(REAL, reversed)).toThrow();
  });

  it("throws when the head piece is empty", () => {
    const headless = {
      ...w,
      parts: [{ anchor: "But he who doubts", chapter: 16, verse: 25 }, ...w.parts.slice(1)],
    };
    expect(() => splitWeldedVerse(REAL, headless)).toThrow();
  });

  it("routes pieces to the parts' targets, not to a 14:24 source label", () => {
    const labelled = {
      bookId: 45,
      chapter: 14,
      verse: 24,
      parts: [
        { anchor: "Beta two.", chapter: 16, verse: 25 },
        { anchor: "Gamma three.", chapter: 16, verse: 26 },
      ],
      note: "fixture",
    };
    const out = splitWeldedVerse("Alpha one. Beta two. Gamma three.", labelled);
    expect(out.map((p) => `${p.chapter}:${p.verse}`)).toEqual(["14:24", "16:25", "16:26"]);
    expect(out.slice(1).some((p) => p.chapter === 14 && p.verse === 24)).toBe(false);
  });
});

describe("unexplainedOmissionErrors", () => {
  it("returns no errors for zero", () => {
    expect(unexplainedOmissionErrors("WEB", 0)).toEqual([]);
  });

  it("names the code and the count when verses are unexplained", () => {
    const errors = unexplainedOmissionErrors("BSB", 2);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("BSB") && e.includes("2"))).toBe(true);
  });
});
