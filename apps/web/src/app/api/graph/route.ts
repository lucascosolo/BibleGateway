import { NextResponse, type NextRequest } from "next/server";

import { corpusCacheHeaders, notModified } from "@/lib/db/cache";
import {
  getBookIndex,
  getInboundReferencesLimited,
  getOutboundReferencesLimited,
} from "@/lib/db/corpus";
import { buildGraph, type XrefFetcher } from "@/lib/crossrefs/graph";
import type { GraphCaps, GraphResponse } from "@/lib/crossrefs/types";
import { InvalidReferenceError, formatRange, parseReference, toUrlSlug } from "@/lib/refs";

// NOT `force-static` — strips the query string under `next start`; see /api/passage/route.ts.
export const dynamic = "force-dynamic";

/**
 * GET /api/graph?ref=Isa+53:5&depth=2&maxDegree=12&maxNodes=60&minVotes=1
 *
 * The deep-dive reference graph. Backs both the desktop force-directed view and the
 * always-available grouped list (`ARCHITECTURE.md` §4.7.1) — same data, two renderings.
 *
 * Hard server-side ceilings below the client-requestable defaults exist specifically because
 * of hub verses: Isaiah 53 alone has several hundred inbound references, and an uncapped
 * two-hop walk from a verse like that is not "a big graph," it is a denial-of-service against
 * your own database. `buildGraph`'s `capped` flags travel to the client so a capped result
 * reads as "capped," never as "this is everything."
 */

// Client-requestable ceilings. Generous enough for real exploration, small enough that even a
// worst-case hub-of-hubs traversal stays fast.
const ABSOLUTE_MAX_DEPTH = 3;
const ABSOLUTE_MAX_DEGREE = 30;
const ABSOLUTE_MAX_NODES = 150;

// Under the real minimum vote in the corpus (-86) — passed to the DB layer so the fetcher
// returns every candidate edge within the degree cap, letting `buildGraph` apply and count the
// real `minVotes` threshold itself. See the fetcher below.
const ALL_VOTES_SENTINEL = -1_000_000;

export async function GET(request: NextRequest) {
  const unchanged = notModified(request);
  if (unchanged) return unchanged;

  const params = request.nextUrl.searchParams;
  const ref = params.get("ref");
  const depth = clampInt(params.get("depth"), 2, 1, ABSOLUTE_MAX_DEPTH);
  const maxDegreePerNode = clampInt(params.get("maxDegree"), 12, 1, ABSOLUTE_MAX_DEGREE);
  const maxNodes = clampInt(params.get("maxNodes"), 60, 1, ABSOLUTE_MAX_NODES);
  const minVotes = clampInt(params.get("minVotes"), 1, 0, 10_000);

  if (!ref) {
    return NextResponse.json({ error: "missing `ref` parameter" }, { status: 400 });
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

  const caps: GraphCaps = { maxDepth: depth, maxDegreePerNode, maxNodes, minVotes };

  // The fetcher is deliberately NOT given `minVotes` — it fetches every candidate within the
  // depth/degree caps, and `buildGraph` applies (and counts) the vote threshold itself. That is
  // what lets `edgeStats` report a true candidate count: filtering in SQL would make the
  // excluded edges invisible before the traversal ever saw them, and "disclose what you cannot
  // see" is not disclosure.
  const fetcher: XrefFetcher = {
    outbound: (r, limit) =>
      getOutboundReferencesLimited(r, ALL_VOTES_SENTINEL, limit).map((row) => ({
        fromVerseId: row.fromVerseId,
        toStartVerse: row.toStartVerse,
        toEndVerse: row.toEndVerse,
        votes: row.votes,
      })),
    inbound: (r, limit) =>
      getInboundReferencesLimited(r, ALL_VOTES_SENTINEL, limit).map((row) => ({
        fromVerseId: row.fromVerseId,
        toStartVerse: row.toStartVerse,
        toEndVerse: row.toEndVerse,
        votes: row.votes,
      })),
  };

  const result = buildGraph(range, fetcher, caps);

  // The traversal identifies nodes purely by verse-id range; fill in the human-facing
  // reference and slug now, once, rather than formatting inside the hot BFS loop.
  for (const node of result.nodes) {
    node.reference = formatRange(node.range, books);
    node.slug = toUrlSlug(node.range, books);
  }

  const body: GraphResponse = {
    ...result,
    reference: formatRange(range, books),
    range: { start: range.start, end: range.end },
  };

  return NextResponse.json(body, {
    headers: corpusCacheHeaders(request),
  });
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
