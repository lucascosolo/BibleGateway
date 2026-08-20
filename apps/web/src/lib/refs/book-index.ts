/**
 * Book lookup, built once from the `books` table.
 *
 * The canon lives in the database, not in a hardcoded array here — the ingest pipeline is
 * the single source of truth for it. This index is the in-memory read model the parser and
 * formatter use, and it is small (66 rows), so it is cheap to build at startup and cache.
 */
import { type BookId, type VerseId, InvalidReferenceError, bookOf, chapterOf } from "./verse-id";

export interface BookRecord {
  bookId: number;
  /** OSIS identifier, e.g. "John", "1Cor", "Ps". */
  osisId: string;
  /** Display name, e.g. "John", "1 Corinthians". */
  name: string;
  /** Preferred short form, e.g. "Jn", "1 Cor". */
  abbreviation: string;
  testament: "OT" | "NT" | "DC";
  chapterCount: number;
}

/**
 * Strip a book name to a comparison key: lowercase, no punctuation or whitespace, and with
 * leading ordinals folded to digits. This is what makes "1 John", "1John", "I John",
 * "First John", "1 Jn." and "1jn" all resolve to the same entry.
 */
export function normalizeBookKey(input: string): string {
  let s = input.trim().toLowerCase();

  // Leading roman numerals and ordinal words -> digits. Anchored so "Romans" is untouched.
  s = s.replace(/^(i{1,3})[\s.]+/, (_, r: string) => `${r.length} `);
  s = s.replace(/^(first|1st)[\s.]+/, "1 ");
  s = s.replace(/^(second|2nd)[\s.]+/, "2 ");
  s = s.replace(/^(third|3rd)[\s.]+/, "3 ");

  // Drop everything that is not a letter or digit.
  return s.replace(/[^a-z0-9]/g, "");
}

/** Common abbreviations and alternate spellings that are not derivable by normalization. */
const EXTRA_ALIASES: Record<string, string> = {
  // Pentateuch
  gen: "Gen", ge: "Gen", gn: "Gen",
  ex: "Exod", exo: "Exod", exod: "Exod",
  lev: "Lev", lv: "Lev",
  num: "Num", nm: "Num", nb: "Num",
  deut: "Deut", dt: "Deut", deu: "Deut",
  // History
  josh: "Josh", jos: "Josh",
  judg: "Judg", jdg: "Judg", jgs: "Judg",
  rt: "Ruth",
  "1sam": "1Sam", "1sa": "1Sam", "1sm": "1Sam", "1kgdms": "1Sam",
  "2sam": "2Sam", "2sa": "2Sam", "2sm": "2Sam",
  "1kgs": "1Kgs", "1ki": "1Kgs", "1kg": "1Kgs",
  "2kgs": "2Kgs", "2ki": "2Kgs", "2kg": "2Kgs",
  "1chr": "1Chr", "1ch": "1Chr", "1chron": "1Chr",
  "2chr": "2Chr", "2ch": "2Chr", "2chron": "2Chr",
  ezr: "Ezra",
  neh: "Neh", ne: "Neh",
  est: "Esth", esth: "Esth", es: "Esth",
  // Wisdom
  jb: "Job",
  ps: "Ps", psa: "Ps", psalm: "Ps", psalms: "Ps", pss: "Ps",
  prov: "Prov", pr: "Prov", prv: "Prov", proverb: "Prov",
  eccl: "Eccl", ec: "Eccl", eccles: "Eccl", qoh: "Eccl", qoheleth: "Eccl",
  song: "Song", sos: "Song", canticles: "Song", cant: "Song",
  songofsongs: "Song", songofsolomon: "Song",
  // Prophets
  isa: "Isa", is: "Isa",
  jer: "Jer", je: "Jer",
  lam: "Lam", la: "Lam",
  ezek: "Ezek", eze: "Ezek", ezk: "Ezek",
  dan: "Dan", dn: "Dan",
  hos: "Hos", ho: "Hos",
  jl: "Joel",
  am: "Amos",
  obad: "Obad", ob: "Obad",
  jon: "Jonah", jnh: "Jonah",
  mic: "Mic", mi: "Mic",
  nah: "Nah", na: "Nah",
  hab: "Hab", hb: "Hab",
  zeph: "Zeph", zep: "Zeph", zp: "Zeph",
  hag: "Hag", hg: "Hag",
  zech: "Zech", zec: "Zech", zc: "Zech",
  mal: "Mal", ml: "Mal",
  // Gospels & Acts
  matt: "Matt", mt: "Matt", mat: "Matt",
  mk: "Mark", mar: "Mark", mrk: "Mark",
  lk: "Luke", luk: "Luke",
  jn: "John", jhn: "John", joh: "John",
  ac: "Acts", act: "Acts",
  // Pauline
  rom: "Rom", ro: "Rom", rm: "Rom",
  "1cor": "1Cor", "1co": "1Cor",
  "2cor": "2Cor", "2co": "2Cor",
  gal: "Gal", ga: "Gal",
  eph: "Eph", ephes: "Eph",
  phil: "Phil", php: "Phil", pp: "Phil",
  col: "Col",
  "1thess": "1Thess", "1th": "1Thess", "1thes": "1Thess",
  "2thess": "2Thess", "2th": "2Thess", "2thes": "2Thess",
  "1tim": "1Tim", "1ti": "1Tim",
  "2tim": "2Tim", "2ti": "2Tim",
  tit: "Titus", ti: "Titus",
  phlm: "Phlm", phm: "Phlm", philem: "Phlm",
  // General
  heb: "Heb", hb2: "Heb",
  jas: "Jas", jm: "Jas", james: "Jas",
  "1pet": "1Pet", "1pe": "1Pet", "1pt": "1Pet",
  "2pet": "2Pet", "2pe": "2Pet", "2pt": "2Pet",
  "1jn": "1John", "1jo": "1John", "1joh": "1John",
  "2jn": "2John", "2jo": "2John", "2joh": "2John",
  "3jn": "3John", "3jo": "3John", "3joh": "3John",
  jud: "Jude", jd: "Jude",
  rev: "Rev", rv: "Rev", apoc: "Rev", apocalypse: "Rev",
};

export class BookIndex {
  private readonly byKey = new Map<string, BookRecord>();
  private readonly byId = new Map<number, BookRecord>();

  constructor(books: readonly BookRecord[]) {
    for (const book of books) {
      this.byId.set(book.bookId, book);
      // Every spelling we can derive from the record itself.
      for (const form of [book.osisId, book.name, book.abbreviation]) {
        this.byKey.set(normalizeBookKey(form), book);
      }
    }
    // Aliases resolve through the OSIS id, so they only register if that book was loaded.
    const byOsis = new Map(books.map((b) => [b.osisId.toLowerCase(), b]));
    for (const [alias, osisId] of Object.entries(EXTRA_ALIASES)) {
      const book = byOsis.get(osisId.toLowerCase());
      if (book && !this.byKey.has(alias)) this.byKey.set(alias, book);
    }
  }

  /** Resolve any spelling of a book name. Returns undefined rather than throwing. */
  find(name: string): BookRecord | undefined {
    return this.byKey.get(normalizeBookKey(name));
  }

  /** Resolve a book name, throwing a descriptive error if it is unknown. */
  require(name: string): BookRecord {
    const book = this.find(name);
    if (!book) throw new InvalidReferenceError(`unknown book: "${name}"`);
    return book;
  }

  get(bookId: number): BookRecord | undefined {
    return this.byId.get(bookId);
  }

  get all(): BookRecord[] {
    return [...this.byId.values()].sort((a, b) => a.bookId - b.bookId);
  }

  /**
   * Structural validity of an address: the book exists and the chapter is within it.
   *
   * This deliberately does NOT verify the verse number — chapter lengths vary and live in
   * the `verses` table. Treat this as a cheap pre-filter, not proof the verse exists.
   */
  isPlausible(id: VerseId): boolean {
    const book = this.byId.get(bookOf(id) as BookId as number);
    if (!book) return false;
    const chapter = chapterOf(id);
    return chapter >= 1 && chapter <= book.chapterCount;
  }
}
