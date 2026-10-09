import { describe, expect, it } from "vitest";
import { OUTSIDE_BOOKS, TRANSLATION_SOURCES } from "./translations.js";
import {
  parseMattisonHtml,
  parseTabText,
  placePlainSource,
  placePlainUnit,
  type PlainSourceId,
} from "./outside-plain.js";

const place = (s: PlainSourceId, part: string, ref: string) => placePlainUnit(s, { part, ref });
const at = (osis: string, chapter: number, verse: number) => ({ osis, chapter, verse });

describe("parseTabText", () => {
  it("reads ref and text, trims text, skips blanks and plain comments", () => {
    const out = parseTabText("# a comment\n\n1:1\t  In the beginning \n1:2\tSecond\n");
    expect(out).toEqual([
      { part: "", ref: "1:1", text: "In the beginning" },
      { part: "", ref: "1:2", text: "Second" },
    ]);
  });
  it("applies a '# book:' header to following units", () => {
    const out = parseTabText("1\tx\n# book: Testament of Levi\n2:1\ty\n# book: Testament of Dan\n3:1\tz");
    expect(out.map((u) => u.part)).toEqual(["", "Testament of Levi", "Testament of Dan"]);
  });
  it("throws with the 1-based line number on a bad line", () => {
    expect(() => parseTabText("1:1\tok\n\nno tab here")).toThrow(/3/);
    expect(() => parseTabText("1:1\tok\n1:2\t   ")).toThrow(/2/);
    expect(() => parseTabText("\ttext")).toThrow(/1/);
  });
});

describe("parseMattisonHtml", () => {
  const html = (body: string) =>
    `<html><body><p><strong>Symbols</strong> [ ] lacuna</p>${body}</body></html>`;

  it("splits paragraphs and page markers into page:ordinal units", () => {
    const out = parseMattisonHtml(
      html(
        `<p style="white-space:pre-wrap;"><strong>7</strong>&nbsp;"Then will [matter] be?"</p>` +
          `<p>Then he said, "because [you love <strong>8</strong>&nbsp;what tricks you.</p>`,
      ),
    );
    expect(out).toEqual([
      { part: "", ref: "7:1", text: `"Then will [matter] be?"` },
      { part: "", ref: "7:2", text: `Then he said, "because [you love` },
      { part: "", ref: "8:1", text: "what tricks you." },
    ]);
  });
  it("skips centred headings and the colophon title, and stops at Notes on Translation", () => {
    const out = parseMattisonHtml(
      html(
        `<p style="text-align:center"><strong>An Eternal Perspective</strong></p>` +
          `<p style="text-align:center"><em>Pages 1 through 6 are missing.</em></p>` +
          `<p><strong>7</strong>&nbsp;First&nbsp;line</p>` +
          `<p>The Gospel<br>According to   Mary</p>` +
          `<p>&quot;Quoted&quot; text</p>` +
          `<p><strong>Notes on Translation</strong></p><p><strong>Page 8</strong> note</p>`,
      ),
    );
    expect(out).toEqual([
      { part: "", ref: "7:1", text: "First line" },
      { part: "", ref: "7:2", text: `"Quoted" text` },
    ]);
  });
  it("drops empty pieces and tolerates whitespace inside the page strong", () => {
    const out = parseMattisonHtml(html(`<p><strong> 12 </strong>&nbsp;</p><p><strong>13</strong> a</p>`));
    expect(out).toEqual([{ part: "", ref: "13:1", text: "a" }]);
  });
  it("throws when text appears before any page marker", () => {
    expect(() => parseMattisonHtml(html(`<p>stray</p>`))).toThrow();
  });
});

describe("placePlainUnit", () => {
  it("places chapter:verse works", () => {
    expect(place("charles-1enoch", "", "1:9")).toEqual(at("1En", 1, 9));
    expect(place("charles-2baruch", "", "3:4")).toEqual(at("2Bar", 3, 4));
    expect(place("gray-psalms-solomon", "", "17:21")).toEqual(at("PssSol", 17, 21));
  });
  it("places Jubilees including its prologue", () => {
    expect(place("charles-jubilees", "", "Prologue")).toEqual(at("Jub", 1, 0));
    expect(place("charles-jubilees", "", "2:3")).toEqual(at("Jub", 2, 3));
  });
  it("places each Testament by part", () => {
    const names: Record<string, string> = {
      Reuben: "TReu", Simeon: "TSim", Levi: "TLevi", Judah: "TJud", Issachar: "TIss", Zebulun: "TZeb",
      Dan: "TDan", Naphtali: "TNaph", Gad: "TGad", Asher: "TAsh", Joseph: "TJos", Benjamin: "TBenj",
    };
    for (const [n, osis] of Object.entries(names))
      expect(place("charles-testaments", `Testament of ${n}`, "2:5")).toEqual(at(osis, 2, 5));
    expect(() => place("charles-testaments", "Testament of Moses", "1:1")).toThrow();
    expect(() => place("charles-testaments", "", "1:1")).toThrow();
  });
  it("places Thomas prologue, logia, and excludes the colophon", () => {
    expect(place("mattison-thomas", "", "prologue")).toEqual(at("GThom", 1, 0));
    expect(place("mattison-thomas", "", "logion 77")).toEqual(at("GThom", 1, 77));
    expect(place("mattison-thomas", "", "colophon")).toBe("excluded");
    expect(() => place("mattison-thomas", "", "saying 3")).toThrow();
  });
  it("uses codex page as chapter for Mary, Judas, Philip", () => {
    expect(place("mattison-mary", "", "9:3")).toEqual(at("GMary", 9, 3));
    expect(place("mattison-judas", "", "33:1")).toEqual(at("GJudas", 33, 1));
    expect(place("mattison-philip", "", "86:2")).toEqual(at("GPhil", 86, 2));
  });
  it("places single-number works", () => {
    expect(place("robinson-gospel-peter", "", "14")).toEqual(at("GPet", 1, 14));
    expect(place("walker-protevangelium", "", "24")).toEqual(at("ProtJas", 24, 1));
    expect(place("lightfoot-didache", "", "16")).toEqual(at("Did", 16, 1));
    expect(place("lightfoot-barnabas", "", "21")).toEqual(at("Barn", 21, 1));
  });
  it("offsets Infancy Thomas forms", () => {
    expect(place("walker-infancy-thomas", "Greek Form A", "3")).toEqual(at("InfThom", 3, 1));
    expect(place("walker-infancy-thomas", "Greek Form B", "3")).toEqual(at("InfThom", 103, 1));
    expect(place("walker-infancy-thomas", "Latin Form", "3")).toEqual(at("InfThom", 203, 1));
    expect(() => place("walker-infancy-thomas", "Syriac Form", "3")).toThrow();
  });
  it("splits Thecla and Apocalypse of Peter by part prefix", () => {
    expect(place("walker-thecla", "Main text (Acts of Paul)", "4")).toEqual(at("PlThec", 1, 4));
    expect(place("walker-thecla", "Grabe's recension", "4")).toEqual(at("PlThec", 2, 4));
    expect(place("james-apocalypse-peter", "Akhmim Greek", "7")).toEqual(at("ApocPet", 1, 7));
    expect(place("james-apocalypse-peter", "Ethiopic version", "para 7")).toEqual(at("ApocPet", 2, 7));
    expect(() => place("james-apocalypse-peter", "Ethiopic version", "7")).toThrow();
  });
  it("places 1 Clement with its prologue", () => {
    expect(place("lightfoot-1clement", "", "Prologue")).toEqual(at("1Clem", 1, 0));
    expect(place("lightfoot-1clement", "", "65")).toEqual(at("1Clem", 65, 1));
  });
  it("places each Ignatian letter", () => {
    const m: Record<string, string> = {
      Ephesians: "IgnEph", Magnesians: "IgnMagn", Trallians: "IgnTrall", Romans: "IgnRom",
      Philadelphians: "IgnPhld", Smyrnaeans: "IgnSmyrn", Polycarp: "IgnPol",
    };
    for (const [p, osis] of Object.entries(m)) expect(place("lightfoot-ignatius", p, "4")).toEqual(at(osis, 4, 1));
    expect(place("lightfoot-ignatius", "Romans", "Prologue")).toEqual(at("IgnRom", 1, 0));
    expect(() => place("lightfoot-ignatius", "Hebrews", "1")).toThrow();
  });
  it("offsets Hermas parts", () => {
    expect(place("lightfoot-hermas", "", "Vision 5")).toEqual(at("Herm", 5, 1));
    expect(place("lightfoot-hermas", "", "Mandate 12")).toEqual(at("Herm", 112, 1));
    expect(place("lightfoot-hermas", "", "Parable 10")).toEqual(at("Herm", 210, 1));
    expect(() => place("lightfoot-hermas", "", "Dream 1")).toThrow();
  });
  it("throws on an unrecognised ref", () => {
    expect(() => place("charles-1enoch", "", "nine")).toThrow();
    expect(() => place("lightfoot-didache", "", "1:2")).toThrow();
  });
});

describe("placePlainSource", () => {
  it("attaches the book id, drops excluded units and keeps text", () => {
    const rows = placePlainSource("mattison-thomas", [
      { part: "", ref: "prologue", text: "These are the secret sayings" },
      { part: "", ref: "logion 1", text: "Whoever finds" },
      { part: "", ref: "colophon", text: "The Gospel of Thomas" },
    ]);
    expect(rows).toEqual([
      { bookId: 101, osis: "GThom", chapter: 1, verse: 0, text: "These are the secret sayings" },
      { bookId: 101, osis: "GThom", chapter: 1, verse: 1, text: "Whoever finds" },
    ]);
  });
  it("resolves book ids for other sources", () => {
    expect(placePlainSource("charles-1enoch", [{ part: "", ref: "1:1", text: "x" }])[0]!.bookId).toBe(85);
    expect(placePlainSource("lightfoot-hermas", [{ part: "", ref: "Vision 1", text: "x" }])[0]!.bookId).toBe(120);
  });
  it("throws when two units land on one address", () => {
    expect(() =>
      placePlainSource("lightfoot-didache", [
        { part: "", ref: "1", text: "a" },
        { part: "", ref: "1", text: "b" },
      ]),
    ).toThrow();
  });
});

describe("outside books status and numbering", () => {
  it("marks every outside book ingested", () => {
    expect(OUTSIDE_BOOKS.filter((b) => b.status !== "ingested")).toEqual([]);
  });
  it("gives Mary, Judas and Philip page numbering", () => {
    for (const o of ["GMary", "GJudas", "GPhil"])
      expect(OUTSIDE_BOOKS.find((b) => b.osisId === o)!.numbering).toBe("page");
    expect(OUTSIDE_BOOKS.find((b) => b.osisId === "GThom")!.numbering).toBe("logion");
  });
});

describe("plain-text translation sources", () => {
  const spec: Record<string, [number, number[]]> = {
    CHARLES: [10, [...Array.from({ length: 14 }, (_, i) => 85 + i), 100]],
    GRAY: [11, [99]],
    MATTISON: [12, [101, 107, 108, 109]],
    ANF: [13, [102, 103, 104, 105]],
    JAMES1924: [14, [106]],
    LIGHTFOOT: [15, Array.from({ length: 11 }, (_, i) => 110 + i)],
  };
  const find = (code: string) => TRANSLATION_SOURCES.find((t) => t.code === code)!;

  it("declares the six outside translations with ids and exact book sets", () => {
    for (const [code, [id, books]] of Object.entries(spec)) {
      const t = find(code);
      expect(t, code).toBeDefined();
      expect(t.translationId).toBe(id);
      expect(t.scope).toBe("outside");
      expect([...t.includedBookIds!].sort((a, b) => a - b)).toEqual(books);
    }
  });
  it("carries attribution and licence fields", () => {
    for (const code of Object.keys(spec)) {
      const t = find(code) as any;
      expect(typeof t.translator).toBe("string");
      expect(t.translator.length).toBeGreaterThan(0);
      expect(typeof t.year).toBe("string");
      expect(t.licenseUrl).toMatch(/^https:\/\//);
    }
  });
  it("lists plain sources with format, 64-hex sha256 and licence evidence", () => {
    for (const code of Object.keys(spec)) {
      const plain = (find(code) as any).plain as any[];
      expect(plain.length, code).toBeGreaterThan(0);
      for (const p of plain) {
        expect(["tab", "mattison-html"]).toContain(p.format);
        expect(p.file.length).toBeGreaterThan(0);
        expect(p.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(p.licenceEvidence).toHaveLength(2);
        expect(p.licenceEvidence[0].length).toBeGreaterThan(0);
        expect(p.licenceEvidence[1].length).toBeGreaterThan(0);
      }
    }
  });
  it("assigns each of the 19 plain source ids to exactly one translation", () => {
    const ids = Object.keys(spec).flatMap((c) => ((find(c) as any).plain as any[]).map((p) => p.id as string));
    expect(ids).toHaveLength(19);
    expect(new Set(ids).size).toBe(19);
    expect(ids).toContain("lightfoot-hermas");
    expect(ids).toContain("mattison-judas");
  });
  it("places each book 85-120 in exactly one of the six", () => {
    for (let id = 85; id <= 120; id++) {
      const owners = Object.keys(spec).filter((c) => find(c)?.includedBookIds?.includes(id));
      expect(owners, String(id)).toHaveLength(1);
    }
  });
  it("names every included book in the scopeNote", () => {
    for (const code of Object.keys(spec)) {
      const t = find(code);
      for (const id of t.includedBookIds ?? []) {
        const name = OUTSIDE_BOOKS.find((b) => b.bookId === id)!.name;
        expect(t.scopeNote, `${code}:${name}`).toContain(name);
      }
    }
  });
  it("keeps translation ids unique", () => {
    const ids = TRANSLATION_SOURCES.map((t) => t.translationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
