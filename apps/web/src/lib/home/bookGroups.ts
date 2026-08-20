/**
 * Grouping the canon for the home page's "browse by book" surface.
 *
 * Pure and separate from the query that produces its input (`getBookBrowseIndex` in
 * `lib/db/corpus.ts`) so the shape of "how books are organized on the page" can be unit
 * tested without a database connection.
 */

export interface BookBrowseEntry {
  bookId: number;
  osisId: string;
  name: string;
  testament: "OT" | "NT" | "DC";
  /** The `books.genre` column is a JSON array — a book can carry more than one, e.g. law+narrative. */
  genres: string[];
  chapterCount: number;
}

export interface GenreGroup {
  genre: string;
  books: BookBrowseEntry[];
}

export interface TestamentGroup {
  testament: BookBrowseEntry["testament"];
  genres: GenreGroup[];
}

/** Display order for genres within a testament — canon order within each, not alphabetical. */
const GENRE_ORDER = [
  "law",
  "narrative",
  "poetry",
  "wisdom",
  "prophecy",
  "apocalyptic",
  "epistle",
];

function genreRank(genre: string): number {
  const i = GENRE_ORDER.indexOf(genre);
  return i === -1 ? GENRE_ORDER.length : i;
}

/**
 * Group books by testament, then by genre.
 *
 * A book is filed under its PRIMARY genre only — the first entry in `books.genre`, which the
 * ingest orders primary-first. Filing it under every genre it carries was the first attempt
 * and it reads as a fault: Genesis appeared under both Law and Narrative, Revelation under
 * both Prophecy and Apocalyptic, and a browse index that lists the same book twice with no
 * explanation looks broken rather than faceted. This surface is an index of the canon, and an
 * index's job is to name each of the 66 books exactly once. The secondary genres stay on the
 * entry for a future filter, which is the control that faceting actually calls for.
 *
 * Testament order is fixed (OT, NT, DC) rather than derived from input order, so the section
 * a researcher expects at the top of the page is always there even if the query result order
 * ever changes.
 */
export function groupBooksForBrowse(entries: readonly BookBrowseEntry[]): TestamentGroup[] {
  const testamentOrder: BookBrowseEntry["testament"][] = ["OT", "NT", "DC"];
  const byTestament = new Map<BookBrowseEntry["testament"], Map<string, BookBrowseEntry[]>>();

  for (const entry of entries) {
    let genreMap = byTestament.get(entry.testament);
    if (!genreMap) {
      genreMap = new Map();
      byTestament.set(entry.testament, genreMap);
    }
    const primary = entry.genres[0] ?? "other";
    const list = genreMap.get(primary) ?? [];
    list.push(entry);
    genreMap.set(primary, list);
  }

  const out: TestamentGroup[] = [];
  for (const testament of testamentOrder) {
    const genreMap = byTestament.get(testament);
    if (!genreMap) continue;
    const genres = [...genreMap.entries()]
      .sort(([a], [b]) => genreRank(a) - genreRank(b))
      .map(([genre, books]) => ({ genre, books }));
    out.push({ testament, genres });
  }
  return out;
}
