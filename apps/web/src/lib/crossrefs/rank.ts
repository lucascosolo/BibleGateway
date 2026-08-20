import { BookIndex } from "@/lib/refs/book-index";
import { bookOf, type VerseId } from "@/lib/refs/verse-id";
import type { ResolvedXref, XrefGroup } from "./types";

/**
 * Ranking and grouping for cross-reference lists.
 *
 * Pure and DB-free so it can be unit tested directly and shared between the API route (which
 * groups server-side for `/api/xrefs`) and any client-side re-sort the panel wants to do
 * without another fetch.
 */

/** Sort strongest (highest vote weight) first; ties broken by canonical verse order. */
export function sortByVotes<T extends { votes: number; range: { start: VerseId } }>(
  items: readonly T[]
): T[] {
  return [...items].sort((a, b) => b.votes - a.votes || a.range.start - b.range.start);
}

/**
 * Bucket resolved cross-references by the book their target falls in, then rank both the
 * items within a group and the groups themselves by vote weight.
 *
 * Grouping by book is what makes a long list legible — "12 references, mostly in Isaiah and
 * the Psalms" is readable at a glance; 12 flat rows are not.
 */
export function groupByTargetBook(items: readonly ResolvedXref[], books: BookIndex): XrefGroup[] {
  const byBook = new Map<number, ResolvedXref[]>();
  for (const item of items) {
    const bookId = bookOf(item.range.start) as number;
    const arr = byBook.get(bookId);
    if (arr) arr.push(item);
    else byBook.set(bookId, [item]);
  }

  const groups: XrefGroup[] = [];
  for (const [bookId, arr] of byBook) {
    const sorted = sortByVotes(arr);
    groups.push({
      bookId,
      bookName: books.get(bookId)?.name ?? `Book ${bookId}`,
      items: sorted,
      topVotes: sorted[0]?.votes ?? 0,
    });
  }

  return groups.sort((a, b) => b.topVotes - a.topVotes || a.bookId - b.bookId);
}
