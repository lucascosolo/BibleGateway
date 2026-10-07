import { describe, expect, it } from "vitest";

import { TRADITION_ORDER, isTraditional, orderPositions, splitPositions } from "./lens";

const pos = (id: string, tradition: string) => ({ id, tradition });

describe("TRADITION_ORDER", () => {
  it("lists evidence-led traditions first and traditional last", () => {
    expect([...TRADITION_ORDER]).toEqual(["archaeological", "critical", "chronological", "traditional"]);
  });
});

describe("isTraditional", () => {
  it("is true only for 'traditional'", () => {
    expect(isTraditional("traditional")).toBe(true);
    for (const t of ["archaeological", "critical", "chronological"]) expect(isTraditional(t)).toBe(false);
  });
});

describe("orderPositions", () => {
  it("sorts by TRADITION_ORDER", () => {
    const out = orderPositions([pos("t", "traditional"), pos("c", "critical"), pos("a", "archaeological"), pos("h", "chronological")]);
    expect(out.map((p) => p.id)).toEqual(["a", "c", "h", "t"]);
  });

  it("is stable for ties and does not mutate its input", () => {
    const input = [pos("c2", "critical"), pos("a", "archaeological"), pos("c1", "critical"), pos("c3", "critical")];
    const copy = [...input];
    expect(orderPositions(input).map((p) => p.id)).toEqual(["a", "c2", "c1", "c3"]);
    expect(input).toEqual(copy);
  });
});

describe("splitPositions", () => {
  it("separates scholarly (in tradition order) from traditional (in input order)", () => {
    const { scholarly, traditional } = splitPositions([
      pos("t1", "traditional"), pos("c", "critical"), pos("t2", "traditional"), pos("a", "archaeological"),
    ]);
    expect(scholarly.map((p) => p.id)).toEqual(["a", "c"]);
    expect(traditional.map((p) => p.id)).toEqual(["t1", "t2"]);
  });

  it("returns empty arrays, not undefined", () => {
    expect(splitPositions([])).toEqual({ scholarly: [], traditional: [] });
  });
});
