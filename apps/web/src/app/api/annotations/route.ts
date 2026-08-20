import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserId } from "@/lib/annotations/auth";
import { checkAnnotationAnchor, parseAnnotationInput } from "@/lib/annotations/validate";
import { getTranslations, getVerseTextLengths, versesExist } from "@/lib/db/corpus";
import { createAnnotation, getAnnotationsInRange } from "@/lib/db/userdata";
import type { VerseId, VerseRange } from "@/lib/refs/verse-id";

/**
 * `/api/annotations` — GET (range fetch) and POST (create).
 *
 * User-scoped and never cached: two different users hitting the same range must never share
 * a cached response, and a user's own writes must be visible immediately.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/annotations?start=43003001&end=43003036
 *
 * The overlap query from ARCHITECTURE §3.3 — every surface (tooltip, panel, modal, reader)
 * calls this with different bounds and gets the identical query shape back.
 */
export async function GET(request: NextRequest) {
  const start = Number(request.nextUrl.searchParams.get("start"));
  const end = Number(request.nextUrl.searchParams.get("end"));
  // Integers, and in order. A fractional bound silently returns nothing from an integer
  // b-tree scan, and a reversed pair returns nothing at all — both look to the caller like
  // "you have no annotations here", which is the worst possible answer to get wrong.
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    return NextResponse.json(
      { error: "`start` and `end` query params must be integer verse ids, with `start` first" },
      { status: 400, headers: NO_STORE }
    );
  }

  const range: VerseRange = { start: start as VerseId, end: end as VerseId };
  const userId = await getCurrentUserId();
  const annotations = getAnnotationsInRange(userId, range);

  return NextResponse.json({ annotations }, { headers: NO_STORE });
}

/**
 * POST /api/annotations — create.
 *
 * Validated in two passes (see `lib/annotations/validate.ts`): shape and arithmetic without
 * touching the corpus, then existence and offset bounds against exactly the two verses the
 * first pass named. Every rejection is a 400 carrying the specific reason, because the caller
 * that gets this wrong is our own selection code and "400 bad request" would not narrow it.
 */
export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400, headers: NO_STORE });
  }

  const parsed = parseAnnotationInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  }
  const input = parsed.value;

  const anchorIds = [input.startVerseId, input.endVerseId];
  const existingVerseIds = versesExist(anchorIds);
  // Only fetched when there are offsets to bound; a whole-verse anchor needs no text length.
  const lengths =
    input.startOffset !== null && input.translationId !== null
      ? getVerseTextLengths(anchorIds, input.translationId)
      : new Map<number, number>();

  const checked = checkAnnotationAnchor(input, {
    existingVerseIds,
    textLength: (verseId) => lengths.get(verseId),
    translationIds: new Set(getTranslations().map((t) => t.translationId)),
  });
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400, headers: NO_STORE });
  }

  const userId = await getCurrentUserId();
  const annotation = createAnnotation(userId, checked.value);

  return NextResponse.json({ annotation }, { status: 201, headers: NO_STORE });
}
