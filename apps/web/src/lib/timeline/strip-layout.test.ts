import { describe, expect, it } from "vitest";

import type { EventSummary } from "@/lib/db/timeline";
import { spanYears } from "./years";
import { entryWindow, layoutBars, limitRows, type StripBar } from "./strip-layout";

function ev(id: string, earliest: number, latest: number, axis: EventSummary["axis"] = "narrative"): EventSummary {
  return { id, title: id, axis, category: "x", confidence: "firm", status: "draft", earliest, latest, traditional: null, bookIds: [], segment: null, gist: "", firstVerse: null };
}

const by = (bars: ReturnType<typeof layoutBars>, id: string) => bars.find((b) => b.id === id)!;

describe("layoutBars", () => {
  it("places left and width from year spans", () => {
    const [bar] = layoutBars([ev("a", -900, -800)], -1000, 0 + 1, 2);
    expect(bar.left).toBe(spanYears(-1000, -900) * 2);
    expect(bar.width).toBe(spanYears(-900, -800) * 2);
  });

  it("enforces a minimum width (default 8px, overridable)", () => {
    expect(layoutBars([ev("a", -701, -701)], -1000, -500, 1)[0].width).toBe(8);
    expect(layoutBars([ev("a", -701, -701)], -1000, -500, 1, 20)[0].width).toBe(20);
  });

  it("gives overlapping events distinct lanes and reuses a freed lane", () => {
    const bars = layoutBars([ev("a", -900, -800), ev("b", -850, -700), ev("c", -780, -750)], -1000, -500, 1);
    expect(by(bars, "a").lane).toBe(0);
    expect(by(bars, "b").lane).toBe(1);
    expect(by(bars, "c").lane).toBe(0);
  });

  it("restarts lane numbering on each axis", () => {
    const bars = layoutBars(
      [ev("n", -900, -800, "narrative"), ev("c", -900, -800, "composition"), ev("k", -900, -800, "canon")],
      -1000, -500, 1,
    );
    expect(bars.map((b) => [b.id, b.axis, b.lane])).toEqual(
      expect.arrayContaining([["n", "narrative", 0], ["c", "composition", 0], ["k", "canon", 0]]),
    );
  });

  it("excludes events outside the window", () => {
    const bars = layoutBars([ev("in", -900, -800), ev("out", -400, -300), ev("before", -1500, -1400)], -1000, -500, 1);
    expect(bars.map((b) => b.id)).toEqual(["in"]);
  });

  it("uses spanYears across year 0 (no year zero counted)", () => {
    const [bar] = layoutBars([ev("a", -4, 30)], -10, 100, 1);
    expect(bar.left).toBe(spanYears(-10, -4));
    expect(bar.width).toBe(33);
    const [after] = layoutBars([ev("b", 10, 20)], -10, 100, 1);
    expect(after.left).toBe(spanYears(-10, 10)); // 19, not 20
    expect(after.left).toBe(19);
  });

  it("lets a traditional lens claim row space without moving the bar", () => {
    const a = { ...ev("a", -1200, -1150), traditional: { earliest: -1500, latest: -1480 } };
    const b = ev("b", -1400, -1300);
    const bars = layoutBars([a, b], -1600, -1000, 1);
    expect(by(bars, "a").left).toBe(spanYears(-1600, -1200));
    expect(by(bars, "a").lane).not.toBe(by(bars, "b").lane);
    const plain = layoutBars([ev("a", -1200, -1150), b], -1600, -1000, 1);
    expect(by(plain, "a").lane).toBe(by(plain, "b").lane);
  });
});

describe("limitRows", () => {
  const bar = (id: string, axis: StripBar["axis"], lane: number): StripBar => ({ id, axis, lane, left: 0, width: 8 });
  const bars = [bar("a", "narrative", 0), bar("b", "narrative", 2), bar("c", "composition", 1), bar("d", "composition", 0), bar("e", "narrative", 1)];

  it("draws bars whose lane is below maxRows and hides the rest, per axis", () => {
    const { drawn, hidden } = limitRows(bars, 2);
    expect(drawn.map((b) => b.id)).toEqual(["a", "c", "d", "e"]);
    expect(hidden.map((b) => b.id)).toEqual(["b"]);
  });

  it("preserves input order in both lists", () => {
    const { drawn, hidden } = limitRows(bars, 1);
    expect(drawn.map((b) => b.id)).toEqual(["a", "d"]);
    expect(hidden.map((b) => b.id)).toEqual(["b", "c", "e"]);
  });

  it("hides nothing at Infinity", () => {
    const { drawn, hidden } = limitRows(bars, Infinity);
    expect(drawn).toEqual(bars);
    expect(hidden).toEqual([]);
  });

  it("draws nothing at 0", () => {
    const { drawn, hidden } = limitRows(bars, 0);
    expect(drawn).toEqual([]);
    expect(hidden).toEqual(bars);
  });
});

describe("layoutBars with entries packed first", () => {
  it("gives the named entries the top row even when earlier neighbours would have taken it", () => {
    const events = [ev("before", -1000, -950), ev("current", -980, -900), ev("after", -890, -880)];
    expect(by(layoutBars(events, -1100, -800, 1), "current").lane).toBe(1);
    const bars = layoutBars(events, -1100, -800, 1, 8, 0, new Set(["current"]));
    expect(by(bars, "current").lane).toBe(0);
    expect(by(bars, "before").lane).toBe(1);
  });

  it("never lets two bars in one row overlap when packed out of date order", () => {
    const events = [ev("a", -1000, -900), ev("b", -950, -850), ev("c", -880, -800), ev("d", -990, -960)];
    const bars = layoutBars(events, -1100, -700, 1, 8, 0, new Set(["c"]));
    for (const x of bars) {
      for (const y of bars) {
        if (x === y || x.axis !== y.axis || x.lane !== y.lane) continue;
        expect(x.left + x.width < y.left || y.left + y.width < x.left).toBe(true);
      }
    }
  });
});

describe("entryWindow", () => {
  it("is null when the entry has nothing dated", () => {
    expect(entryWindow([])).toBeNull();
  });

  it("covers a short event with at least a century of context each side, on half-centuries", () => {
    const window = entryWindow([{ earliest: -722, latest: -720 }])!;
    expect(window).toEqual({ from: -850, to: -600 });
    expect(Math.abs(window.from % 50)).toBe(0);
    expect(Math.abs(window.to % 50)).toBe(0);
  });

  it("covers every linked event of a person, with context proportional to the envelope", () => {
    const window = entryWindow([
      { earliest: -1010, latest: -970 },
      { earliest: -600, latest: -580 },
    ])!;
    expect(window.from).toBeLessThanOrEqual(-1010 - 215);
    expect(window.to).toBeGreaterThanOrEqual(-580 + 215);
  });

  it("never lands on year zero", () => {
    expect(entryWindow([{ earliest: -100, latest: -100 }])!.to).not.toBe(0);
    expect(entryWindow([{ earliest: 100, latest: 100 }])!.from).not.toBe(0);
  });
});
