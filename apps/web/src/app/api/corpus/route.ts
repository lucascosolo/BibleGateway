import { NextResponse, type NextRequest } from "next/server";

import { getAudioBuildId, hasAudio } from "@/lib/db/audio";
import { audioCacheHeaders, audioNotModified } from "@/lib/db/cache";
import { getCorpusBuildId, getCorpusSources } from "@/lib/db/client";
import { getCanonicalVerseCount, getOutsideVerseCounts } from "@/lib/db/corpus";
import { getOutsideBooks } from "@/lib/db/outside";

export const dynamic = "force-dynamic";

/**
 * GET /api/corpus
 *
 * Machine-readable identity for citations and reproducible research. The build id identifies the
 * derived SQLite corpus; source rows identify the exact upstream archives and their SHA-256
 * checksums. `audioBuildId` identifies the separately built recordings artifact, or is null when
 * this deployment has none. `canonicalVerseCount` is the 66-book address space (31,102), never
 * a sum with the outside books: `outside.canons` counts the stored verses of books 67 and up per
 * canon, and `outside.books` groups those books by canon with their numbering scheme and the
 * translations that print them. This is intentionally public: a read-only corpus is useful only if a researcher can
 * say which inputs they consulted.
 */
export async function GET(request: NextRequest) {
  // Versioned by both artifacts the body names; a tag on the corpus alone would answer 304 with
  // a stale `audioBuildId` after an audio-only rebuild.
  const unchanged = audioNotModified(request);
  if (unchanged) return unchanged;

  const outsideBooks = getOutsideBooks();
  const canons = getOutsideVerseCounts().map((row) => ({
    ...row,
    bookList: outsideBooks
      .filter((book) => book.canon === row.canon)
      .map(({ bookId, osisId, name, numbering, verses, translations }) => ({ bookId, osisId, name, numbering, verses, translations })),
  }));

  return NextResponse.json(
    {
      buildId: getCorpusBuildId(),
      audioBuildId: hasAudio() ? getAudioBuildId() : null,
      canonicalVerseCount: getCanonicalVerseCount(),
      outside: { canons },
      sources: getCorpusSources(),
    },
    { headers: audioCacheHeaders(request) },
  );
}
