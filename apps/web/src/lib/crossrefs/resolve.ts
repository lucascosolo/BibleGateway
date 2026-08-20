import "server-only";

import type { CrossReference, VerseText } from "@/lib/db/corpus";
import { getFirstVerseTexts } from "@/lib/db/corpus";
import { BookIndex } from "@/lib/refs/book-index";
import { formatRange, toUrlSlug } from "@/lib/refs/parse";
import type { VerseRange } from "@/lib/refs/verse-id";
import { xrefTier } from "./tiers";
import type { ResolvedXref } from "./types";

/**
 * Turn raw `cross_references` rows into `ResolvedXref`s: a human reference, a navigable URL
 * slug, a vote tier, and the target's first verse of text — everything `<CrossRefPanel>` needs
 * to render a row through `<PassageRenderer density="panel">` without a second fetch.
 *
 * `direction` picks which end of the row is "the other passage": outbound rows point *at*
 * `to_start_verse`/`to_end_verse`; inbound rows point *at* `from_verse_id`.
 */
export function resolveXrefs(
  rows: readonly CrossReference[],
  direction: "outbound" | "inbound",
  translationId: number,
  books: BookIndex
): ResolvedXref[] {
  const previews = getFirstVerseTexts(
    rows.map((r) => (direction === "outbound" ? r.toStartVerse : r.fromVerseId)),
    translationId
  );

  return rows.map((row) => {
    const range: VerseRange =
      direction === "outbound"
        ? { start: row.toStartVerse, end: row.toEndVerse }
        : { start: row.fromVerseId, end: row.fromVerseId };

    const preview: VerseText | null = previews.get(range.start) ?? null;

    return {
      range,
      reference: formatRange(range, books),
      slug: toUrlSlug(range, books),
      votes: row.votes,
      tier: xrefTier(row.votes),
      source: row.source,
      preview,
    };
  });
}
