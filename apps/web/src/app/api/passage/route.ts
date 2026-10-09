import { NextResponse, type NextRequest } from "next/server";

import { corpusCacheHeaders, notModified } from "@/lib/db/cache";
import { getFootnotes, getOmissions } from "@/lib/db/apparatus";
import {
  getOutsideBookIndex,
  getPassage,
  getTranslationByCode,
  getTranslations,
} from "@/lib/db/corpus";
import { InvalidReferenceError, formatRange, parseReference } from "@/lib/refs";

// NOT `force-static`: that statically renders the handler and strips the query string, so
// `ref` and `translation` arrive undefined. The corpus is still immutable, so cacheability
// comes from explicit response headers below rather than from route config.
export const dynamic = "force-dynamic";

/**
 * GET /api/passage?ref=John+3:16-18&translation=WEB[&footnotes=1]
 *
 * Outside books (ids 67-120) resolve too: `ref=Thomas+42`, `ref=Sir+1:1`; the response `book` says
 * which canon and numbering scheme the address uses. `t` is accepted as an alias for `translation`, matching reader URLs. `footnotes=1` adds the
 * translation's own notes on the returned verses; it is off by default so the payload every
 * reading surface already parses does not change shape.
 *
 * The one endpoint every reading surface uses — tooltip, side panel, timeline modal and the
 * full reader all call this with different bounds. Deliberately cacheable forever: the text
 * of a translation never changes, so this can sit on a CDN edge indefinitely. User
 * annotations are fetched separately and are never cached.
 */
export async function GET(request: NextRequest) {
  const unchanged = notModified(request);
  if (unchanged) return unchanged;

  // `request.nextUrl` rather than `new URL(request.url)`: the latter loses the query string
  // under `next start` once the route has been marked cacheable.
  const ref = request.nextUrl.searchParams.get("ref");
  const params = request.nextUrl.searchParams;
  const translationCode = params.get("translation") ?? params.get("t") ?? "WEB";
  const footnotesFlag = params.get("footnotes");

  if (!ref) {
    return NextResponse.json({ error: "missing `ref` parameter" }, { status: 400 });
  }
  // A flag that silently ignores a value it does not understand reads as "this verse has no
  // notes", which is indistinguishable from the real answer.
  if (footnotesFlag !== null && footnotesFlag !== "0" && footnotesFlag !== "1") {
    return NextResponse.json({ error: "`footnotes` must be 0 or 1" }, { status: 400 });
  }

  const translation = getTranslationByCode(translationCode);
  if (!translation) {
    return NextResponse.json(
      {
        error: `unknown translation "${translationCode}"`,
        available: getTranslations().map((t) => t.code),
      },
      { status: 404 }
    );
  }

  // The full index: outside references such as "Thomas 42" or "Sir 1:1" resolve like any other.
  const books = getOutsideBookIndex();

  let range;
  try {
    range = parseReference(ref, books);
  } catch (error) {
    if (error instanceof InvalidReferenceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const startBook = books.get(Math.floor(range.start / 1_000_000));
  const bookInfo = startBook
    ? { bookId: startBook.bookId, osisId: startBook.osisId, canon: startBook.canon ?? "bible", numbering: startBook.numbering ?? "chapter-verse" }
    : null;

  const verses = getPassage(range, translation.translationId);

  // The apparatus travels with the text, in the same payload and the same order. A caller
  // that renders only `verses` gets a silent gap in the verse numbering, which is precisely
  // the ambiguity `verse_omissions` exists to remove.
  const omissions = [...getOmissions(range, translation.translationId).values()].map((o) => ({
    verseId: o.verseId as number,
    verse: o.verse,
    reason: o.reason,
    history: o.history,
    kind: o.kind,
    printedBy: o.printedBy.map(({ code, name }) => ({ code, name })),
  }));

  // 404 means "this reference addresses nothing", not "this translation prints nothing here".
  // `?ref=John+5:4&translation=BSB` is a real verse that BSB declines to print, and answering
  // 404 for it told every caller the reference was bad — the same defect that made switching
  // translation in the reader lose the reader's place.
  if (verses.length === 0 && omissions.length === 0) {
    return NextResponse.json(
      { error: `no verses found for "${ref}" in ${translation.code}` },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      reference: formatRange(range, books),
      range: { start: range.start, end: range.end },
      translation: {
        code: translation.code,
        name: translation.name,
        // Licensors audit for this; it must travel with the text, not live in a footer
        // somewhere the reader never scrolls to.
        copyright: translation.copyrightNotice,
      },
      book: bookInfo,
      verses,
      omissions,
      ...(footnotesFlag === "1"
        ? { footnotes: getFootnotes(verses.map((v) => v.verseId), translation.translationId) }
        : {}),
    },
    // Cacheable against the corpus build id rather than forever — see `lib/db/cache.ts`.
    // User annotations are fetched separately and are never cached.
    { headers: corpusCacheHeaders(request) }
  );
}
