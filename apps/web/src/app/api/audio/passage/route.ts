import { NextResponse, type NextRequest } from "next/server";

import { getPassageAudio } from "@/lib/db/audio";
import { audioCacheHeaders, audioNotModified } from "@/lib/db/cache";
import { getBookIndex, getChapterCount, getExistingVerseIds, getTranslationByCode } from "@/lib/db/corpus";
import { InvalidReferenceError, bookOf, chapterOf, formatRange, parseReference } from "@/lib/refs";
import { canonicalReferenceSlug } from "@/lib/seo";
import type { ReaderPassage } from "@/lib/store/audio";

// NOT `force-static`: that strips the query string. Cacheability comes from the headers.
export const dynamic = "force-dynamic";

/**
 * GET /api/audio/passage?ref=John.5&t=WEB
 *
 * What the reader page would publish to the player for this chapter — recordings, verse ids,
 * and the following chapter's href — without the text. The player fetches it ahead of a
 * chapter boundary so `ended` can switch files inside the event handler, which is the only
 * continuation a locked iPhone allows. No verse text, so it is not a route to a second
 * renderer.
 */
export async function GET(request: NextRequest) {
  const unchanged = audioNotModified(request);
  if (unchanged) return unchanged;

  const ref = request.nextUrl.searchParams.get("ref");
  const code = request.nextUrl.searchParams.get("t") ?? "WEB";
  if (!ref) return NextResponse.json({ error: "missing `ref` parameter" }, { status: 400 });

  const translation = getTranslationByCode(code);
  if (!translation) return NextResponse.json({ error: `unknown translation "${code}"` }, { status: 404 });

  const books = getBookIndex();
  let range;
  try {
    range = parseReference(ref, books);
  } catch (error) {
    if (error instanceof InvalidReferenceError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  // One chapter at a time: the player asks for the chapter that follows the one playing, and a
  // whole-book or cross-book ref would make the route assemble every chapter's timings and
  // compute `nextHref` from the wrong end of the range. The route is public, so the bound is
  // enforced here rather than trusted to the caller.
  if (bookOf(range.start) !== bookOf(range.end) || chapterOf(range.start) !== chapterOf(range.end)) {
    return NextResponse.json({ error: `"${ref}" spans more than one chapter; ask for one chapter` }, { status: 400 });
  }

  const verseIds = getExistingVerseIds(range);
  if (verseIds.length === 0) return NextResponse.json({ error: `no verses found for "${ref}"` }, { status: 404 });

  const audio = getPassageAudio(range);
  if (!audio || audio.chapters.length === 0) {
    return NextResponse.json({ error: `no recording of "${ref}"` }, { status: 404 });
  }

  // The same `nextHref` the reader page computes, so the page the player moves to is the one
  // the pager would have opened.
  const bookId = bookOf(range.start) as number;
  const book = books.get(bookId);
  const chapter = chapterOf(range.start);
  const body: ReaderPassage = {
    slug: canonicalReferenceSlug(range, books),
    label: formatRange(range, books),
    bookName: book?.name ?? formatRange(range, books),
    translationCode: translation.code,
    renderedVerseIds: verseIds,
    nextHref: chapter < getChapterCount(bookId) ? `/read/${book?.osisId}.${chapter + 1}?t=${translation.code}` : null,
    audio,
  };
  return NextResponse.json(body, { headers: audioCacheHeaders(request) });
}
