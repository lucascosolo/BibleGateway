import { getOutsideBookIndex } from "@/lib/db/corpus";
import type { WorkSummary, VerseLink } from "@/lib/db/timeline";
import { formatRange, toUrlSlug } from "@/lib/refs";
import { withDisplay } from "@/lib/timeline/years";

/**
 * Presentation of work records for `/api/timeline/works`. A work with no filed dating has
 * `composed: null` and says why in `composedUndated`; a range is never supplied for it.
 */

const span = (earliest: number | null, latest: number | null) =>
  earliest === null || latest === null ? null : withDisplay({ earliest, latest });

export function workSummaryView<T extends WorkSummary>(work: T) {
  const index = getOutsideBookIndex();
  const { composedEarliest, composedLatest, traditionalEarliest, traditionalLatest, bookIds, ...rest } = work;
  return {
    ...rest,
    composed: span(composedEarliest, composedLatest),
    traditional: span(traditionalEarliest, traditionalLatest),
    books: bookIds.flatMap((bookId) => {
      const book = index.get(bookId);
      return book ? [{ bookId, osisId: book.osisId, name: book.name }] : [];
    }),
    href: `/api/timeline/works/${work.id}`,
    page: `/chitzonim/works/${work.id}`,
  };
}

/** Verse links labelled against the full book index, since a work's verses are in outside books. */
export function labelWorkVerses(links: readonly VerseLink[]) {
  const index = getOutsideBookIndex();
  return links.map((link) => {
    const range = { start: link.start, end: link.end };
    return { ...link, label: formatRange(range, index), path: `/read/${toUrlSlug(range, index)}` };
  });
}
