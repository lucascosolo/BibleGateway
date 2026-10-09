import { describe, expect, it } from "vitest";
import { BOOKS } from "./books.js";
import {
  canonOf,
  OMISSION_REASON_EDITION,
  omissionExplanation,
  OUTSIDE_BOOKS,
  TRANSLATION_SOURCES,
  unexplainedGaps,
} from "./translations.js";
import { placeEdition, placeOutsideUnit, type OutsideUnit } from "./outside.js";
import { OUTSIDE_EXPECTED_VERSES } from "./outside-maps.js";

const u = (usfm: string, chapter: number, verse: number, part = "") => ({ usfm, chapter, verse, part });
const unit = (usfm: string, chapter: number, verse: number, part: string, text: string): OutsideUnit => ({
  ...u(usfm, chapter, verse, part),
  text,
  footnotes: [],
});
const byId = (id: number) => OUTSIDE_BOOKS.find((b) => b.bookId === id)!;

describe("OUTSIDE_BOOKS id table", () => {
  it("is exactly 67..120, contiguous, with unique osis ids that never collide with the 66", () => {
    expect(OUTSIDE_BOOKS.map((b) => b.bookId)).toEqual(Array.from({ length: 54 }, (_, i) => 67 + i));
    const osis = OUTSIDE_BOOKS.map((b) => b.osisId);
    expect(new Set(osis).size).toBe(osis.length);
    const canonical = new Set(BOOKS.map((b) => b.osisId));
    expect(osis.filter((o) => canonical.has(o))).toEqual([]);
  });

  it("pins the spot ids and numbering schemes", () => {
    const spots: [number, string][] = [
      [67, "Tob"], [69, "AddEsth"], [71, "Sir"], [73, "EpJer"], [74, "PrAzar"], [83, "Ps151"],
      [84, "2Esd"], [85, "1En"], [87, "TReu"], [98, "TBenj"], [100, "2Bar"], [101, "GThom"],
      [102, "GPet"], [110, "Did"], [112, "IgnEph"], [118, "IgnPol"], [120, "Herm"],
    ];
    for (const [id, osis] of spots) expect(byId(id).osisId).toBe(osis);
    expect(byId(101).numbering).toBe("logion");
    expect(byId(102).numbering).toBe("section");
    expect(byId(110).numbering).toBe("chapter");
    expect(byId(120).numbering).toBe("part-chapter");
  });

  it("marks 67-84 ingested and 85-120 allocated", () => {
    for (const b of OUTSIDE_BOOKS) expect(b.status).toBe(b.bookId <= 84 ? "ingested" : "allocated");
  });

  it("assigns canon by id range", () => {
    for (const b of OUTSIDE_BOOKS) {
      const want = b.bookId <= 84 ? "deuterocanon" : b.bookId <= 100 ? "pseudepigrapha" : b.bookId <= 109 ? "nt-apocrypha" : "apostolic";
      expect(b.canon).toBe(want);
    }
  });
});

describe("canonOf", () => {
  it("answers for the 66 and the outside books", () => {
    expect(canonOf(1)).toBe("hebrew");
    expect(canonOf(39)).toBe("hebrew");
    expect(canonOf(40)).toBe("nt");
    expect(canonOf(66)).toBe("nt");
    expect(canonOf(101)).toBe("nt-apocrypha");
  });
  it("throws for an id with no book", () => {
    expect(() => canonOf(121)).toThrow();
  });
});

describe("placeOutsideUnit, Brenton LXX", () => {
  it("places lettered and reviewed units", () => {
    expect(placeOutsideUnit("LXX", u("TOB", 4, 7, "a"))).toEqual({ osis: "Tob", chapter: 4, verse: 8 });
    expect(placeOutsideUnit("LXX", u("TOB", 4, 7, "l"))).toEqual({ osis: "Tob", chapter: 4, verse: 18 });
    expect(placeOutsideUnit("LXX", u("LJE", 1, 5))).toEqual({ osis: "EpJer", chapter: 1, verse: 5 });
    expect(placeOutsideUnit("LXX", u("PSA", 151, 3))).toEqual({ osis: "Ps151", chapter: 1, verse: 3 });
  });

  it("puts the Sirach prologue at 1:0 and leaves the rest alone", () => {
    expect(placeOutsideUnit("LXX", u("SIR", 1, 1, ""))).toMatchObject({ osis: "Sir", chapter: 1, verse: 0 });
    expect(placeOutsideUnit("LXX", u("SIR", 1, 1, "g"))).toMatchObject({ osis: "Sir", chapter: 1, verse: 0 });
    expect(placeOutsideUnit("LXX", u("SIR", 1, 1, "h"))).toMatchObject({ osis: "Sir", chapter: 1, verse: 1 });
    expect(placeOutsideUnit("LXX", u("SIR", 2, 3, ""))).toEqual({ osis: "Sir", chapter: 2, verse: 3 });
  });

  it("excludes canonical text of Psalms, Esther and Daniel", () => {
    expect(placeOutsideUnit("LXX", u("PSA", 23, 1))).toBe("excluded");
    expect(placeOutsideUnit("LXX", u("ESG", 2, 1, ""))).toBe("excluded");
    expect(placeOutsideUnit("LXX", u("DAG", 1, 1, ""))).toBe("excluded");
  });

  it("places the additions to Esther and Daniel", () => {
    expect(placeOutsideUnit("LXX", u("ESG", 1, 1, ""))).toEqual({ osis: "AddEsth", chapter: 11, verse: 2 });
    expect(placeOutsideUnit("LXX", u("ESG", 10, 3, "l"))).toEqual({ osis: "AddEsth", chapter: 11, verse: 1 });
    expect(placeOutsideUnit("LXX", u("DAG", 3, 24, ""))).toEqual({ osis: "PrAzar", chapter: 1, verse: 1 });
    expect(placeOutsideUnit("LXX", u("DAG", 3, 90, ""))).toEqual({ osis: "PrAzar", chapter: 1, verse: 68 });
    const mid = placeOutsideUnit("LXX", u("DAG", 3, 30, ""));
    expect(mid).not.toBe("excluded");
    expect(mid).toMatchObject({ osis: "PrAzar" });
  });

  it("joins a letter to its base verse", () => {
    expect(placeOutsideUnit("LXX", u("4MA", 11, 6, "a"))).toEqual({ osis: "4Macc", chapter: 11, verse: 6 });
  });

  it("throws on a lettered Esther unit with no reviewed placement", () => {
    expect(() => placeOutsideUnit("LXX", u("ESG", 2, 1, "q"))).toThrow();
  });
});

describe("placeOutsideUnit, KJV Apocrypha", () => {
  it("moves reviewed units", () => {
    expect(placeOutsideUnit("KJVA", u("BAR", 6, 5))).toEqual({ osis: "EpJer", chapter: 1, verse: 5 });
    expect(placeOutsideUnit("KJVA", u("BAR", 5, 1))).toEqual({ osis: "Bar", chapter: 5, verse: 1 });
    expect(placeOutsideUnit("KJVA", u("S3Y", 1, 30))).toEqual({ osis: "PrAzar", chapter: 1, verse: 30 });
    expect(placeOutsideUnit("KJVA", u("ESG", 13, 9))).toEqual({ osis: "AddEsth", chapter: 13, verse: 9 });
    expect(placeOutsideUnit("KJVA", u("2ES", 7, 1))).toEqual({ osis: "2Esd", chapter: 7, verse: 1 });
    expect(placeOutsideUnit("KJVA", u("TOB", 10, 8))).toEqual({ osis: "Tob", chapter: 10, verse: 9 });
    expect(placeOutsideUnit("KJVA", u("TOB", 10, 7))).toEqual({ osis: "Tob", chapter: 10, verse: 7 });
    expect(placeOutsideUnit("KJVA", u("SIR", 33, 16))).toEqual({ osis: "Sir", chapter: 30, verse: 25 });
  });

  it("reports reviewed unplaced text", () => {
    expect(placeOutsideUnit("KJVA", u("SIR", 20, 3))).toBe("unplaced");
  });

  it("allows only the Sirach prologue at verse 0", () => {
    expect(placeOutsideUnit("KJVA", u("SIR", 1, 0))).toEqual({ osis: "Sir", chapter: 1, verse: 0 });
    expect(() => placeOutsideUnit("KJVA", u("TOB", 1, 0))).toThrow();
  });

  it("excludes protocanonical books", () => {
    expect(placeOutsideUnit("KJVA", u("GEN", 1, 1))).toBe("excluded");
  });
});

describe("placeEdition", () => {
  it("joins units sharing an address in source order", () => {
    const { placed, unplaced } = placeEdition("LXX", [unit("SIR", 1, 1, "", "A"), unit("SIR", 1, 1, "a", "B")]);
    expect(unplaced).toBe(0);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ osis: "Sir", chapter: 1, verse: 0, bookId: 71, text: "A B" });
    expect(placed[0].sources).toHaveLength(2);
  });

  it("drops excluded units", () => {
    expect(placeEdition("LXX", [unit("PSA", 23, 1, "", "x")])).toEqual({ placed: [], unplaced: 0 });
  });

  it("counts unplaced units without placing them", () => {
    expect(placeEdition("KJVA", [unit("SIR", 20, 3, "", "x")])).toEqual({ placed: [], unplaced: 1 });
  });
});

describe("unexplainedGaps and omissionExplanation for outside books", () => {
  it("treats a printed outside book as in scope whatever the scope", () => {
    const t = { scope: "OT" as const, printedBookIds: new Set([67]), explained: new Set([67_001_001]) };
    expect(unexplainedGaps([67_001_001, 67_001_002], t)).toEqual([67_001_002]);
    expect(unexplainedGaps([67_001_001, 67_001_002], { ...t, printedBookIds: new Set<number>() })).toEqual([]);
  });

  it("explains an outside-book gap as an edition difference", () => {
    expect(omissionExplanation(undefined, 71_001_005)).toEqual({
      kind: "versification",
      reason: OMISSION_REASON_EDITION,
      history: "",
    });
  });
});

describe("TRANSLATION_SOURCES outside editions", () => {
  const kjva = TRANSLATION_SOURCES.find((t) => t.code === "KJVA");
  const lxx = TRANSLATION_SOURCES.find((t) => t.code === "LXX");

  it("declares KJVA as an outside-scope edition", () => {
    expect(kjva).toBeDefined();
    expect(kjva).toMatchObject({ translationId: 9, scope: "outside", versification: "kjva", outsideBooks: true });
    expect(kjva!.includedBookIds).toContain(84);
    for (const id of [79, 80, 83]) expect(kjva!.includedBookIds).not.toContain(id);
  });

  it("gives LXX books 67-83 and not 2 Esdras", () => {
    for (let id = 67; id <= 83; id++) expect(lxx!.includedBookIds).toContain(id);
    expect(lxx!.includedBookIds).not.toContain(84);
  });

  it("never shares a translationId", () => {
    const ids = TRANSLATION_SOURCES.map((t) => t.translationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("OUTSIDE_EXPECTED_VERSES", () => {
  it("has a key for exactly the 18 ingested books", () => {
    const ingested = OUTSIDE_BOOKS.filter((b) => b.status === "ingested").map((b) => b.osisId).sort();
    expect(ingested).toHaveLength(18);
    expect(Object.keys(OUTSIDE_EXPECTED_VERSES).sort()).toEqual(ingested);
  });

  it("sums to the total of its values", () => {
    const sum = Object.values(OUTSIDE_EXPECTED_VERSES).reduce((a, b) => a + b, 0);
    expect(sum).toBe(6_437);
  });
});
