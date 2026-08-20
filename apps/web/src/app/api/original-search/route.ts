import { NextResponse, type NextRequest } from "next/server";

import { corpusCacheHeaders, notModified } from "@/lib/db/cache";
import { getTranslationByCode, getTranslations } from "@/lib/db/corpus";
import { searchOriginalWords } from "@/lib/db/originals";
import { clampSearchPagination } from "@/lib/search/query";
import type { OriginalSearchApiResponse } from "@/lib/search/types";

export const dynamic = "force-dynamic";

/** GET /api/original-search?q=agape&language=grc&morph=V&translation=WEB */
export async function GET(request: NextRequest) {
  const unchanged = notModified(request);
  if (unchanged) return unchanged;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ error: "missing `q` parameter" }, { status: 400 });
  const languageRaw = request.nextUrl.searchParams.get("language");
  const language = languageRaw === "hbo" || languageRaw === "arc" || languageRaw === "grc" ? languageRaw : undefined;
  if (languageRaw && !language) return NextResponse.json({ error: "language must be hbo, arc, or grc" }, { status: 400 });

  const translationCode = request.nextUrl.searchParams.get("translation") ?? "WEB";
  const translation = getTranslationByCode(translationCode);
  if (!translation) return NextResponse.json({ error: `unknown translation "${translationCode}"`, available: getTranslations().map((t) => t.code) }, { status: 404 });

  const { limit, offset } = clampSearchPagination(
    request.nextUrl.searchParams.get("limit"),
    request.nextUrl.searchParams.get("offset"),
  );
  const result = searchOriginalWords(q, {
    language,
    morph: request.nextUrl.searchParams.get("morph") ?? undefined,
    limit,
    offset,
    translationId: translation.translationId,
  });
  const body: OriginalSearchApiResponse = {
    query: q,
    mode: "original",
    language,
    morph: request.nextUrl.searchParams.get("morph") ?? undefined,
    total: result.total,
    returned: result.hits.length,
    limit,
    offset,
    hits: result.hits.map((hit) => ({
      verseId: hit.verseId,
      chapter: hit.chapter,
      verse: hit.verse,
      text: hit.text,
      heatBucket: 0,
      bookId: hit.bookId,
      bookName: hit.bookName,
      matches: [],
      original: {
        surface: hit.surface,
        lemma: hit.lemma,
        morph: hit.morph,
        language: hit.language,
        position: hit.position,
        strongs: hit.strongs,
      },
    })),
    bookDistribution: result.bookDistribution,
  };
  return NextResponse.json(body, { headers: corpusCacheHeaders(request) });
}
