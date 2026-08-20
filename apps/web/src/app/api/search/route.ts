import { NextResponse, type NextRequest } from "next/server";

import { corpusCacheHeaders, notModified } from "@/lib/db/cache";
import { getBookIndex, getTranslationByCode, getTranslations, searchVerses } from "@/lib/db/corpus";
import { clampSearchPagination } from "@/lib/search/query";
import type { SearchApiResponse } from "@/lib/search/types";

// NOT `force-static` — see apps/web/src/app/api/passage/route.ts for why: it strips the query
// string under `next start`, and this route is nothing but query params.
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=grace&translation=WEB&testament=NT&book=45&limit=20&offset=0
 *
 * Derash — full-text search (ARCHITECTURE.md §4.6). `q` is free text or, from the caller's
 * point of view, indistinguishable from a reference: `/derash` decides which affordance to
 * show by running `classifySearchQuery` itself, since that decision drives UI (a "go to
 * passage" banner) rather than anything this endpoint needs to branch on.
 */
export async function GET(request: NextRequest) {
  const unchanged = notModified(request);
  if (unchanged) return unchanged;

    const q = request.nextUrl.searchParams.get("q") ?? "";
  const translationCode = request.nextUrl.searchParams.get("translation") ?? "WEB";
  const testamentRaw = request.nextUrl.searchParams.get("testament");
  const testament = testamentRaw === "OT" || testamentRaw === "NT" || testamentRaw === "DC" ? testamentRaw : undefined;
  const bookParam = request.nextUrl.searchParams.get("book");
  const bookId = bookParam !== null ? Number.parseInt(bookParam, 10) : undefined;
  const { limit, offset } = clampSearchPagination(
    request.nextUrl.searchParams.get("limit"),
    request.nextUrl.searchParams.get("offset")
  );

  if (!q.trim()) {
    return NextResponse.json({ error: "missing `q` parameter" }, { status: 400 });
  }

  const translation = getTranslationByCode(translationCode);
  if (!translation) {
    return NextResponse.json(
      { error: `unknown translation "${translationCode}"`, available: getTranslations().map((t) => t.code) },
      { status: 404 }
    );
  }

  if (bookId !== undefined && (!Number.isInteger(bookId) || !getBookIndex().get(bookId))) {
    return NextResponse.json({ error: `unknown book id "${bookParam}"` }, { status: 400 });
  }

  const result = searchVerses(q, translation.translationId, { testament, bookId, limit, offset });

  const body: SearchApiResponse = {
    query: q,
    translation: { code: translation.code },
    testament,
    bookId,
    total: result.total,
    returned: result.hits.length,
    limit,
    offset,
    hits: result.hits,
    bookDistribution: result.bookDistribution,
  };

  // Deterministic in the corpus build plus the query string — see `lib/db/cache.ts`.
  return NextResponse.json(body, { headers: corpusCacheHeaders(request) });
}
