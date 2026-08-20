import "server-only";

import { createHash } from "node:crypto";

import { getCorpusBuildId } from "./client";

/**
 * Cache policy for corpus reads.
 *
 * Every `/api` route that reads `bible.db` returns a deterministic function of an immutable
 * build artifact, so the response is cacheable for a long time — but only for *that build*.
 * These routes previously sent `max-age=31536000, immutable` on unversioned URLs, which is a
 * promise the app cannot keep: a corpus rebuild that corrects a verse or repairs the
 * cross-reference table would have been invisible to every client already holding the old
 * answer, for a year, with no way to invalidate.
 *
 * The fix is a validator rather than a shorter guess. The corpus build id (content-derived,
 * stamped by the ingest) becomes the ETag:
 *
 * - `max-age=60` — a browser re-checks within a minute, cheaply.
 * - `s-maxage=300` — a shared cache re-checks within five.
 * - `stale-while-revalidate=86400` — neither recheck ever blocks a render; the stale body is
 *   served immediately and refreshed behind it.
 *
 * A matching `If-None-Match` returns 304 with no body, so the steady-state cost of being
 * correct here is one conditional request, not a re-download.
 *
 * `s-maxage` was `31536000` and that defeated the entire mechanism. A validator only runs when
 * the cache decides the entry is stale; a shared cache told the response is fresh for a year is
 * *never* required to revalidate, so it may serve the old corpus for a year without ever
 * sending the `If-None-Match` the ETag exists to answer. An ETag behind a year of freshness is
 * not a safety net, it is unreachable code. Freshness lifetime and validation are not
 * alternatives that add up — the shorter one has to be short enough to reach the other.
 */
export function corpusCacheHeaders(request: Request): Record<string, string> {
  return {
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    ETag: etagFor(request),
    Vary: "Accept-Encoding",
    // Public read-only corpus data can be called by browser tools and hosted LLM clients.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "ETag, X-Total-Count, X-Exported-Count, X-Export-Truncated",
  };
}

/**
 * The tag is scoped to the request as well as the build.
 *
 * HTTP validators are per-URL by definition — a cache only replays `If-None-Match` against
 * the entry it read it from — but every response from these routes would otherwise carry a
 * byte-identical tag, so a single client bug (or an over-eager intermediary) turns "I have
 * this corpus" into "I have this passage" and a request for Romans 8 gets a 304 for John 3.
 * Folding the path and query in makes that failure impossible rather than merely unlikely.
 */
function etagFor(request: Request): string {
  // Required, not optional: an earlier call site omitted it and shipped an unscoped tag, which
  // is the exact failure this function exists to prevent.
  const build = getCorpusBuildId();
  const url = new URL(request.url);
  const query = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const scope = createHash("sha256")
    .update(`${build}\n${url.pathname}\n${JSON.stringify(query)}`)
    .digest("hex")
    .slice(0, 16);
  return `"corpus-${build}-${scope}"`;
}

/** 304 for a client that already holds this build's answer, or null to serve normally. */
export function notModified(request: Request): Response | null {
  const headers = corpusCacheHeaders(request);
  const inm = request.headers.get("if-none-match");
  if (!inm) return null;
  // A conditional GET may carry a list, and a proxy may weaken the tag to `W/"…"`.
  const tags = inm.split(",").map((t) => t.trim().replace(/^W\//, ""));
  if (!tags.includes(headers.ETag) && !tags.includes("*")) return null;
  return new Response(null, { status: 304, headers });
}
