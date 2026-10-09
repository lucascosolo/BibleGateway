// The outside books filed as plain text (chunk 4): Charles, Gray, Mattison, the ANF translators,
// James and Lightfoot-Harmer. Sources, licences and numbering: docs/sources/outside-books.md.
// Each text keeps the numbering its edition prints; the address scheme per book is the
// `numbering` column in translations.ts (OUTSIDE_BOOKS).
import { OUTSIDE_BOOKS } from "./translations.js";

export interface PlainUnit {
  part: string;
  ref: string;
  text: string;
}

export type PlainSourceId =
  | "charles-1enoch" | "charles-jubilees" | "charles-testaments" | "charles-2baruch"
  | "gray-psalms-solomon"
  | "mattison-thomas" | "mattison-mary" | "mattison-judas" | "mattison-philip"
  | "robinson-gospel-peter" | "walker-protevangelium" | "walker-infancy-thomas" | "walker-thecla"
  | "james-apocalypse-peter"
  | "lightfoot-didache" | "lightfoot-1clement" | "lightfoot-ignatius" | "lightfoot-barnabas" | "lightfoot-hermas";

/** The filed `text.txt` format: `<ref>\t<text>` per line, `# book: <part>` headers, `# ` comments. */
export function parseTabText(text: string): PlainUnit[] {
  const units: PlainUnit[] = [];
  let part = "";
  text.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (!line.trim()) return;
    if (line.startsWith("# book: ")) {
      part = line.slice(8).trim();
      return;
    }
    if (line.startsWith("# ")) return;
    const tab = line.indexOf("\t");
    const ref = tab < 0 ? "" : line.slice(0, tab).trim();
    const body = tab < 0 ? "" : line.slice(tab + 1).trim();
    if (!ref || !body) throw new Error(`[outside] line ${i + 1}: expected "<ref>\\t<text>", got ${JSON.stringify(line.slice(0, 60))}`);
    units.push({ part, ref, text: body });
  });
  return units;
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    const v = ENTITIES[e.toLowerCase()];
    if (v === undefined) throw new Error(`[outside] unknown HTML entity ${m}`);
    return v;
  });
}

const plain = (html: string) => decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

/**
 * Mark Mattison's gospels.net pages (Mary, Judas, Philip). He prints the codex page numbers
 * inline and no verse numbers, so a unit is a paragraph piece on one page: `<page>:<ordinal>`.
 * Centred paragraphs are his headings and notes; the closing title and his notes are not text.
 */
export function parseMattisonHtml(html: string): PlainUnit[] {
  const start = html.indexOf("<strong>Symbols</strong>");
  if (start < 0) throw new Error("[outside] Mattison page: no Symbols key");
  const notes = html.indexOf("Notes on Translation", start);
  const end = notes < 0 ? html.length : notes;
  const content = html.slice(html.indexOf("</p>", start) + 4, end);
  const units: PlainUnit[] = [];
  let page = 0;
  let ordinal = 0;
  for (const [, attrs, inner] of content.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g)) {
    if (attrs.includes("text-align:center")) continue;
    if (/^The Gospel\s+(According to|of)\s+\w+$/i.test(plain(inner))) continue;
    inner.split(/<strong>\s*(\d+)\s*<\/strong>/).forEach((piece, i) => {
      if (i % 2 === 1) {
        page = Number(piece);
        ordinal = 0;
        return;
      }
      const text = plain(piece);
      if (!text) return;
      if (page === 0) throw new Error(`[outside] Mattison page: text before any page number: ${JSON.stringify(text.slice(0, 40))}`);
      units.push({ part: "", ref: `${page}:${++ordinal}`, text });
    });
  }
  return units;
}

const TESTAMENTS: Record<string, string> = {
  Reuben: "TReu", Simeon: "TSim", Levi: "TLevi", Judah: "TJud", Issachar: "TIss", Zebulun: "TZeb",
  Dan: "TDan", Naphtali: "TNaph", Gad: "TGad", Asher: "TAsh", Joseph: "TJos", Benjamin: "TBenj",
};
const IGNATIUS: Record<string, string> = {
  Ephesians: "IgnEph", Magnesians: "IgnMagn", Trallians: "IgnTrall", Romans: "IgnRom",
  Philadelphians: "IgnPhld", Smyrnaeans: "IgnSmyrn", Polycarp: "IgnPol",
};
const INFANCY_BANDS: Record<string, number> = { "Greek Form A": 0, "Greek Form B": 100, "Latin Form": 200 };
const HERMAS_BANDS: Record<string, number> = { Vision: 0, Mandate: 100, Parable: 200 };
const SINGLE: Partial<Record<PlainSourceId, string>> = {
  "charles-1enoch": "1En", "charles-jubilees": "Jub", "charles-2baruch": "2Bar", "gray-psalms-solomon": "PssSol",
  "mattison-mary": "GMary", "mattison-judas": "GJudas", "mattison-philip": "GPhil",
  "lightfoot-didache": "Did", "lightfoot-1clement": "1Clem", "lightfoot-barnabas": "Barn",
};

type Placement = { osis: string; chapter: number; verse: number };

/** Where one unit of a filed text lives. Anything this does not recognise throws. */
export function placePlainUnit(source: PlainSourceId, u: { part: string; ref: string }): Placement | "excluded" {
  const fail = (): never => {
    throw new Error(`[outside] ${source}: no address for ${u.part ? `${u.part} ` : ""}${JSON.stringify(u.ref)}`);
  };
  const int = (s: string | undefined) => (s !== undefined && /^\d+$/.test(s) && Number(s) > 0 ? Number(s) : fail());
  const at = (osis: string | undefined, chapter: number, verse: number): Placement => ({ osis: osis ?? fail(), chapter, verse });
  const cv = (osis: string | undefined) => {
    const m = u.ref.match(/^(\d+):(\d+)$/) ?? fail();
    return at(osis, int(m[1]), int(m[2]));
  };
  const prologue = u.ref === "Prologue";
  switch (source) {
    case "charles-1enoch":
    case "charles-2baruch":
    case "gray-psalms-solomon":
    case "mattison-mary":
    case "mattison-judas":
    case "mattison-philip":
      return cv(SINGLE[source]);
    case "charles-jubilees":
      return prologue ? at("Jub", 1, 0) : cv("Jub");
    case "charles-testaments":
      return cv(TESTAMENTS[u.part.match(/^Testament of (\w+)$/)?.[1] ?? ""]);
    case "mattison-thomas":
      if (u.ref === "colophon") return "excluded";
      if (u.ref === "prologue") return at("GThom", 1, 0);
      return at("GThom", 1, int(u.ref.match(/^logion (\d+)$/)?.[1]));
    case "robinson-gospel-peter":
      return at("GPet", 1, int(u.ref));
    case "walker-protevangelium":
      return at("ProtJas", int(u.ref), 1);
    case "walker-infancy-thomas":
      return at("InfThom", (INFANCY_BANDS[u.part] ?? fail()) + int(u.ref), 1);
    case "walker-thecla":
      return at("PlThec", u.part.startsWith("Main text") ? 1 : u.part.startsWith("Grabe") ? 2 : fail(), int(u.ref));
    case "james-apocalypse-peter":
      if (u.part.startsWith("Akhmim")) return at("ApocPet", 1, int(u.ref));
      if (u.part.startsWith("Ethiopic")) return at("ApocPet", 2, int(u.ref.match(/^para (\d+)$/)?.[1]));
      return fail();
    case "lightfoot-didache":
    case "lightfoot-barnabas":
    case "lightfoot-1clement":
      return prologue && source === "lightfoot-1clement" ? at("1Clem", 1, 0) : at(SINGLE[source], int(u.ref), 1);
    case "lightfoot-ignatius":
      return prologue ? at(IGNATIUS[u.part], 1, 0) : at(IGNATIUS[u.part], int(u.ref), 1);
    case "lightfoot-hermas": {
      const m = u.ref.match(/^(Vision|Mandate|Parable) (\d+)$/) ?? fail();
      return at("Herm", HERMAS_BANDS[m[1]] + int(m[2]), 1);
    }
  }
  return fail();
}

/** Places every unit of one filed text; two units on one address is a build failure. */
export function placePlainSource(source: PlainSourceId, units: readonly PlainUnit[]) {
  const bookIdByOsis = new Map(OUTSIDE_BOOKS.map((b) => [b.osisId, b.bookId]));
  const seen = new Set<string>();
  const placed: { bookId: number; osis: string; chapter: number; verse: number; text: string }[] = [];
  for (const u of units) {
    const to = placePlainUnit(source, u);
    if (to === "excluded") continue;
    const bookId = bookIdByOsis.get(to.osis);
    if (bookId === undefined) throw new Error(`[outside] no book id for ${to.osis}`);
    const k = `${to.osis}.${to.chapter}.${to.verse}`;
    if (seen.has(k)) throw new Error(`[outside] ${source}: two units at ${k}`);
    seen.add(k);
    placed.push({ bookId, ...to, text: u.text });
  }
  return placed;
}
