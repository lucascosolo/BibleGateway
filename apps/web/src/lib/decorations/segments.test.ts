import { describe, expect, it } from "vitest";

import {
  buildSegments,
  decorationsKey,
  dominantDecoration,
  isApproximate,
  segmentClasses,
  type Decoration,
} from "./segments";

const deco = (id: string, kind: Decoration["kind"], start: number, end: number): Decoration => ({
  id,
  kind,
  start,
  end,
});

const TEXT = "For God so loved the world";

describe("buildSegments", () => {
  it("returns one undecorated segment when there are no decorations", () => {
    expect(buildSegments(TEXT, [])).toEqual([
      { start: 0, end: TEXT.length, text: TEXT, decorations: [] },
    ]);
  });

  it("splits around a single decoration", () => {
    const segments = buildSegments(TEXT, [deco("a", "highlight", 4, 7)]);
    expect(segments.map((s) => s.text)).toEqual(["For ", "God", " so loved the world"]);
    expect(segments[1].decorations.map((d) => d.id)).toEqual(["a"]);
    expect(segments[0].decorations).toEqual([]);
  });

  it("reconstructs the original text exactly", () => {
    const segments = buildSegments(TEXT, [
      deco("a", "highlight", 4, 12),
      deco("b", "variant", 8, 20),
      deco("c", "note", 0, 3),
    ]);
    expect(segments.map((s) => s.text).join("")).toBe(TEXT);
  });

  it("handles partial overlap without nesting", () => {
    // highlight 4-12, variant 8-20 -> the 8-12 stretch carries BOTH.
    const segments = buildSegments(TEXT, [
      deco("hl", "highlight", 4, 12),
      deco("var", "variant", 8, 20),
    ]);
    const both = segments.find((s) => s.decorations.length === 2);
    expect(both).toBeDefined();
    expect(both!.start).toBe(8);
    expect(both!.end).toBe(12);
    expect(both!.decorations.map((d) => d.id).sort()).toEqual(["hl", "var"]);
  });

  it("handles a decoration fully containing another", () => {
    const segments = buildSegments(TEXT, [
      deco("outer", "highlight", 0, TEXT.length),
      deco("inner", "note", 4, 7),
    ]);
    expect(segments.map((s) => s.text).join("")).toBe(TEXT);
    const inner = segments.find((s) => s.text === "God");
    expect(inner!.decorations).toHaveLength(2);
    // Every segment is covered by the outer decoration.
    expect(segments.every((s) => s.decorations.some((d) => d.id === "outer"))).toBe(true);
  });

  it("handles identical ranges", () => {
    const segments = buildSegments(TEXT, [
      deco("a", "highlight", 4, 7),
      deco("b", "note", 4, 7),
    ]);
    expect(segments).toHaveLength(3);
    expect(segments[1].decorations).toHaveLength(2);
  });

  it("clamps a decoration that overruns the text rather than dropping it", () => {
    // An annotation anchored in a longer translation must still render here.
    const segments = buildSegments(TEXT, [deco("a", "highlight", 20, 999)]);
    expect(segments.map((s) => s.text).join("")).toBe(TEXT);
    expect(segments[segments.length - 1].decorations.map((d) => d.id)).toEqual(["a"]);
    expect(segments[segments.length - 1].end).toBe(TEXT.length);
  });

  it("discards zero-width and reversed ranges", () => {
    expect(buildSegments(TEXT, [deco("a", "highlight", 5, 5)])[0].decorations).toEqual([]);
    expect(buildSegments(TEXT, [deco("b", "highlight", 9, 4)])[0].decorations).toEqual([]);
  });

  it("returns nothing for empty text", () => {
    expect(buildSegments("", [deco("a", "highlight", 0, 5)])).toEqual([]);
  });

  it("never produces overlapping or out-of-order segments", () => {
    const segments = buildSegments(TEXT, [
      deco("a", "highlight", 2, 9),
      deco("b", "note", 5, 14),
      deco("c", "variant", 0, 26),
      deco("d", "source", 11, 12),
    ]);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].start).toBe(segments[i - 1].end);
      expect(segments[i].end).toBeGreaterThan(segments[i].start);
    }
  });
});

describe("dominantDecoration", () => {
  it("prefers a highlight over a source-criticism tint", () => {
    const segments = buildSegments(TEXT, [
      deco("src", "source", 0, 26),
      deco("hl", "highlight", 4, 7),
    ]);
    const both = segments.find((s) => s.text === "God")!;
    expect(dominantDecoration(both)!.id).toBe("hl");
  });

  it("returns null for a bare segment", () => {
    expect(dominantDecoration({ start: 0, end: 3, text: "For", decorations: [] })).toBeNull();
  });
});

describe("decorationsKey", () => {
  it("is stable regardless of input order", () => {
    const a = [deco("a", "highlight", 1, 2), deco("b", "note", 3, 4)];
    const b = [deco("b", "note", 3, 4), deco("a", "highlight", 1, 2)];
    expect(decorationsKey(a)).toBe(decorationsKey(b));
  });

  it("changes when a range moves", () => {
    expect(decorationsKey([deco("a", "highlight", 1, 2)])).not.toBe(
      decorationsKey([deco("a", "highlight", 1, 3)])
    );
  });

  /**
   * These four are the regression. The key used to cover only (kind, id, offsets), so every
   * mutation that changes the PAYLOAD and nothing else produced an identical key, the verse
   * memo held, and the change never reached the screen.
   */
  it("changes when a highlight is recoloured", () => {
    const amber = { ...deco("a", "highlight", 1, 5), data: { color: "amber" } };
    const rose = { ...deco("a", "highlight", 1, 5), data: { color: "rose" } };
    expect(decorationsKey([amber])).not.toBe(decorationsKey([rose]));
  });

  it("changes when an optimistic write is confirmed", () => {
    const pending = { ...deco("a", "highlight", 1, 5), data: { color: "amber", pending: true } };
    const saved = { ...deco("a", "highlight", 1, 5), data: { color: "amber", pending: false } };
    expect(decorationsKey([pending])).not.toBe(decorationsKey([saved]));
  });

  it("changes when a mark becomes approximate", () => {
    const exact = { ...deco("a", "highlight", 0, 5), data: { approximate: false } };
    const approx = { ...deco("a", "highlight", 0, 5), data: { approximate: true } };
    expect(decorationsKey([exact])).not.toBe(decorationsKey([approx]));
  });

  it("is stable across payload key order", () => {
    const a = { ...deco("a", "note", 1, 5), data: { color: "moss", pending: true } };
    const b = { ...deco("a", "note", 1, 5), data: { pending: true, color: "moss" } };
    expect(decorationsKey([a])).toBe(decorationsKey([b]));
  });
});

describe("approximate marks", () => {
  it("recognises only an explicitly approximate decoration", () => {
    expect(isApproximate(deco("a", "highlight", 0, 5))).toBe(false);
    expect(isApproximate({ ...deco("a", "highlight", 0, 5), data: {} })).toBe(false);
    // A deliberate whole-verse anchor is exact, and must not be labelled approximate.
    expect(
      isApproximate({ ...deco("a", "highlight", 0, 5), data: { approximate: false } })
    ).toBe(false);
    expect(
      isApproximate({ ...deco("a", "highlight", 0, 5), data: { approximate: true } })
    ).toBe(true);
  });

  it("gives an approximate segment a class of its own", () => {
    const approx = { ...deco("a", "highlight", 4, 7), data: { approximate: true } };
    const [, marked] = buildSegments(TEXT, [approx]);
    expect(segmentClasses(marked)).toContain("deco-approximate");
  });

  it("leaves an exact segment unmarked", () => {
    const [, marked] = buildSegments(TEXT, [deco("a", "highlight", 4, 7)]);
    expect(segmentClasses(marked)).not.toContain("deco-approximate");
  });

  it("marks a segment when any of its overlapping decorations is approximate", () => {
    // An exact search hit and an imprecise highlight can cover the same characters; the
    // imprecision is a property of the mark, and it must survive the composition.
    const segments = buildSegments(TEXT, [
      deco("hit", "search-hit", 4, 12),
      { ...deco("hl", "highlight", 0, 26), data: { approximate: true } },
    ]);
    expect(segments.every((s) => segmentClasses(s).includes("deco-approximate"))).toBe(true);
  });
});
