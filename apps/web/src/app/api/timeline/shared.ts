import { NextResponse } from "next/server";

import { timelineCacheHeaders } from "@/lib/db/cache";
import { getBookIndex } from "@/lib/db/corpus";
import type { VerseLink } from "@/lib/db/timeline";
import { formatRange, toUrlSlug } from "@/lib/refs";
import { formatRange as formatYears } from "@/lib/timeline/years";

/**
 * Presentation shared by the `/api/timeline` routes: verse ids become a readable label and a
 * reader path, and year pairs gain the display string the UI would otherwise rebuild. Lives
 * under `app/` because labelling needs the corpus book index, which the boundary rule keeps out
 * of `lib/`.
 */

export function labelVerses(links: readonly VerseLink[]) {
  const books = getBookIndex();
  return links.map((link) => {
    const range = { start: link.start, end: link.end };
    return { ...link, label: formatRange(range, books), path: `/read/${toUrlSlug(range, books)}` };
  });
}

export function withYears<T extends { earliest: number; latest: number }>(item: T) {
  return { ...item, display: formatYears(item.earliest, item.latest) };
}

export function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: timelineCacheHeaders(request) });
}

/** Errors are not cached: a 404 for an event added in the next build must not outlive it. */
export function problem(status: 400 | 404, error: string) {
  return NextResponse.json({ error }, { status });
}
