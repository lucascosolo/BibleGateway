/**
 * Derash — full-text search support.
 *
 * Everything here is pure and DB-free on purpose: `corpus.ts` owns the actual FTS5 queries,
 * this module owns the parts of that pipeline worth unit-testing without a database — turning
 * arbitrary user input into safe FTS5 query syntax, turning `highlight()`'s marked-up output
 * back into character offsets, classifying a query as a reference vs. free text, and clamping
 * pagination.
 */
import { tryParseReference, type ParsedReference } from "@/lib/refs/parse";
import type { BookIndex } from "@/lib/refs/book-index";

// --- Query sanitization ------------------------------------------------------------------

/**
 * Turn free-typed user input into a syntactically-safe FTS5 MATCH expression.
 *
 * FTS5's query grammar treats `"`, `*`, `:`, `(`, `)`, `-` and the bareword keywords
 * NOT/AND/OR as syntax, not text — a bare `"` or an unbalanced `(` throws `fts5: syntax
 * error near ...` from `MATCH`, which without this would surface as a 500. Rather than trying
 * to escape every special character, this only ever emits the two constructs that ARE always
 * valid: a double-quoted literal (safe because we control the quoting and double any `"`
 * inside a token) and a trailing-`*` prefix match on a bare word. Every token is quoted or
 * prefix-matched, then space-joined, which FTS5's default query syntax ANDs together — so
 * "NOT" or "OR" typed by a user searches for the literal word, not the operator.
 *
 * Returns "" when the input has no word content (e.g. a bare `"` or only punctuation) — the
 * caller's job is to treat that as "no query" rather than passing it to MATCH at all.
 */
export function sanitizeFtsQuery(input: string): string {
  const tokens = input.match(/[\p{L}\p{N}]+\*?/gu) ?? [];
  return tokens
    .map((token) => {
      if (token.endsWith("*") && token.length > 1) return token;
      const word = token.endsWith("*") ? token.slice(0, -1) : token;
      return `"${word.replace(/"/g, '""')}"`;
    })
    .join(" ");
}

// --- Highlight offsets --------------------------------------------------------------------

/** Control characters, never legitimate in normalized verse text — see normalize-text.ts. */
export const HIGHLIGHT_START = "";
export const HIGHLIGHT_END = "";

export interface MatchOffset {
  /** Inclusive character offset into the verse text. */
  start: number;
  /** Exclusive character offset into the verse text. */
  end: number;
}

/**
 * Parse FTS5 `highlight(tbl, col, HIGHLIGHT_START, HIGHLIGHT_END)` output back into character
 * offsets against the ORIGINAL (unmarked) text.
 *
 * This is what lets search hits go through the same decoration pipeline as every other
 * overlay (`lib/decorations/segments.ts`, kind `"search-hit"`) instead of a second,
 * regex-based highlighter: `highlight()` never touches `verse_texts` itself (that table stays
 * plain, per the no-markup invariant), it only marks up a copy returned for this one request,
 * and this function converts that copy into the same `{start,end}` shape every other
 * decoration already speaks.
 *
 * (FTS5 also has an `offsets()` aux function that returns raw offsets without needing this
 * parse step, but it is unusable here: SQLite rejects it — "unable to use function offsets in
 * the requested context" — the moment the query joins the FTS5 table to `verses`/`books` for
 * book/testament filtering, which every search query needs to do. `highlight()` has no such
 * restriction and is exactly as available.)
 */
export function parseHighlightMarkers(marked: string): MatchOffset[] {
  const matches: MatchOffset[] = [];
  let clean = "";
  let i = 0;
  while (i < marked.length) {
    const startIdx = marked.indexOf(HIGHLIGHT_START, i);
    if (startIdx === -1) break;
    clean += marked.slice(i, startIdx);
    const endIdx = marked.indexOf(HIGHLIGHT_END, startIdx + 1);
    if (endIdx === -1) break; // malformed — stop rather than mis-render the rest
    const start = clean.length;
    clean += marked.slice(startIdx + 1, endIdx);
    matches.push({ start, end: clean.length });
    i = endIdx + 1;
  }
  return matches;
}

// --- Query classification -----------------------------------------------------------------

export type QueryClassification =
  | { mode: "reference"; reference: ParsedReference }
  | { mode: "text" };

/**
 * Decide whether a Derash query is a scripture reference ("Rom 8:28") or free text ("grace").
 *
 * A researcher typing a reference wants the passage, not a word match — this is what drives
 * the "go to passage" affordance above the text results. Delegates entirely to
 * `tryParseReference`, which already handles every spelling the app accepts elsewhere; this
 * exists so the search UI has one clear entry point rather than re-deciding the rules.
 */
export function classifySearchQuery(query: string, books: BookIndex): QueryClassification {
  const trimmed = query.trim();
  if (!trimmed) return { mode: "text" };
  const reference = tryParseReference(trimmed, books);
  return reference ? { mode: "reference", reference } : { mode: "text" };
}

// --- Pagination ------------------------------------------------------------------------

export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 100;

/** Clamp raw query-string pagination params to sane bounds — never trust them verbatim. */
export function clampSearchPagination(
  rawLimit: string | null,
  rawOffset: string | null
): { limit: number; offset: number } {
  const limitN = rawLimit === null ? NaN : Number.parseInt(rawLimit, 10);
  const limit = Number.isFinite(limitN)
    ? Math.min(SEARCH_MAX_LIMIT, Math.max(1, limitN))
    : SEARCH_DEFAULT_LIMIT;

  const offsetN = rawOffset === null ? NaN : Number.parseInt(rawOffset, 10);
  const offset = Number.isFinite(offsetN) && offsetN > 0 ? offsetN : 0;

  return { limit, offset };
}
