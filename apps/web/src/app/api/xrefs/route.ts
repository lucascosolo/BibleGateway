import { NextResponse, type NextRequest } from "next/server";

import { corpusCacheHeaders, notModified } from "@/lib/db/cache";
import {
  countInboundReferences,
  countOutboundReferences,
  countUniqueReferences,
  getBookIndex,
  getInboundReferencesLimited,
  getOutboundReferencesLimited,
  getTranslationByCode,
  getTranslations,
} from "@/lib/db/corpus";
import { groupByTargetBook } from "@/lib/crossrefs/rank";
import { resolveXrefs } from "@/lib/crossrefs/resolve";
import type { XrefsResponse } from "@/lib/crossrefs/types";
import { InvalidReferenceError, formatRange, parseReference } from "@/lib/refs";

// NOT `force-static` — see apps/web/src/app/api/passage/route.ts for why: it strips the query
// string under `next start`, and this route is nothing but query params.
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;

/**
 * GET /api/xrefs?ref=John+3:16&translation=WEB&minVotes=0&limit=40
 *
 * Outbound and inbound cross-references for a passage, each resolved to a human reference, a
 * navigable slug, a vote tier, and the target's first verse of text — enough for
 * `<CrossRefPanel>` to render every row through `<PassageRenderer density="panel">` without a
 * second round trip. Grouped by target book and ranked strongest-first within each group.
 */
export async function GET(request: NextRequest) {
  const unchanged = notModified(request);
  if (unchanged) return unchanged;

  const ref = request.nextUrl.searchParams.get("ref");
  const translationCode = request.nextUrl.searchParams.get("translation") ?? "WEB";
  // Lower bound allows a negative sentinel so the panel's "All" filter can mean literally all
  // votes, including the corpus's negative-vote cross-references — a `0` floor here would
  // silently re-exclude them regardless of what the client asked for.
  const minVotes = clampInt(request.nextUrl.searchParams.get("minVotes"), 0, -1_000_000, 10_000);
  const limit = clampInt(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);

  if (!ref) {
    return NextResponse.json({ error: "missing `ref` parameter" }, { status: 400 });
  }

  const translation = getTranslationByCode(translationCode);
  if (!translation) {
    return NextResponse.json(
      { error: `unknown translation "${translationCode}"`, available: getTranslations().map((t) => t.code) },
      { status: 404 }
    );
  }

  const books = getBookIndex();

  let range;
  try {
    range = parseReference(ref, books);
  } catch (error) {
    if (error instanceof InvalidReferenceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const outboundRows = getOutboundReferencesLimited(range, minVotes, limit);
  const inboundRows = getInboundReferencesLimited(range, minVotes, limit);
  const outboundTotal = countOutboundReferences(range, minVotes);
  const inboundTotal = countInboundReferences(range, minVotes);
  // The real total, counted once per record. The client used to add the two directional
  // counts, which double-counts every reference that runs both ways (32 of them for John 3).
  const uniqueTotal = countUniqueReferences(range, minVotes);

  const outboundResolved = resolveXrefs(outboundRows, "outbound", translation.translationId, books);
  const inboundResolved = resolveXrefs(inboundRows, "inbound", translation.translationId, books);

  const body: XrefsResponse = {
    reference: formatRange(range, books),
    range: { start: range.start, end: range.end },
    translation: { code: translation.code },
    total: uniqueTotal,
    outbound: {
      groups: groupByTargetBook(outboundResolved, books),
      returned: outboundResolved.length,
      total: outboundTotal,
    },
    inbound: {
      groups: groupByTargetBook(inboundResolved, books),
      returned: inboundResolved.length,
      total: inboundTotal,
    },
  };

  // The cross-reference corpus is a build artifact like the translations, not user data,
  // so it is cached against the corpus build id — see `lib/db/cache.ts`.
  return NextResponse.json(body, { headers: corpusCacheHeaders(request) });
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
