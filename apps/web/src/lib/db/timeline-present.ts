import "server-only";

import { getBookIndex } from "./corpus";
import type { VerseLink } from "./timeline";
import { formatRange, toUrlSlug } from "@/lib/refs";

/**
 * Presentation of timeline rows that needs the corpus: verse ids become a readable label and a
 * reader path, book ids become names. Shared by the `/api/timeline` routes and by any page that
 * renders the timeline server-side, so the two cannot drift. In the db layer because it reads
 * the corpus book index, which the boundary rule keeps out of the rest of `lib/`.
 */

export function labelVerses(links: readonly VerseLink[]) {
  const books = getBookIndex();
  return links.map((link) => {
    const range = { start: link.start, end: link.end };
    return { ...link, label: formatRange(range, books), path: `/read/${toUrlSlug(range, books)}` };
  });
}

export function bookNames(bookIds: readonly number[]): string[] {
  const books = getBookIndex();
  return bookIds.flatMap((id) => {
    const name = books.get(id)?.name;
    return name ? [name] : [];
  });
}
