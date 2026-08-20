import { NextResponse, type NextRequest } from "next/server";

import { corpusCacheHeaders, notModified } from "@/lib/db/cache";
import {
  getGreekEditionVariants,
  getGreekManuscriptReadings,
  getInterlinear,
  getOriginalTexts,
  getOriginalVariants,
} from "@/lib/db/originals";
import { getBookIndex } from "@/lib/db/corpus";
import { InvalidReferenceError, formatRange, parseReference } from "@/lib/refs";

export const dynamic = "force-dynamic";

/**
 * GET /api/originals?ref=John+3:16
 *
 * A read-only research payload: word-level originals, Qere/Kethiv, edition differences and
 * witness-level Greek readings all share the same canonical range and source metadata. It is
 * intentionally one endpoint so an external tool cannot accidentally compare rows that came
 * from different references or corpus builds.
 */
export async function GET(request: NextRequest) {
  const unchanged = notModified(request);
  if (unchanged) return unchanged;

  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) return NextResponse.json({ error: "missing `ref` parameter" }, { status: 400 });

  let range;
  try {
    range = parseReference(ref, getBookIndex());
  } catch (error) {
    if (error instanceof InvalidReferenceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json(
    {
      reference: formatRange(range, getBookIndex()),
      range: { start: range.start, end: range.end },
      sources: getOriginalTexts(),
      words: getInterlinear(range),
      qereReadings: getOriginalVariants(range),
      greekEditionVariants: getGreekEditionVariants(range),
      greekManuscriptReadings: getGreekManuscriptReadings(range),
    },
    { headers: corpusCacheHeaders(request) },
  );
}
