import type { BookIndex } from "./book-index";
import { formatRange, toUrlSlug, tryParseReference } from "./parse";

/**
 * What the home page's jump/search box should do with a line of user input.
 *
 * One function, shared by the server redirect (`/go`, works with JS disabled) and the client
 * preview (shows the interpretation before the user commits) — so the two can never disagree
 * about whether "Rom 8" is a reference or a search term.
 */
export type QueryIntent =
  | { type: "empty" }
  | { type: "reference"; slug: string; label: string }
  | { type: "search"; query: string };

export function classifyQuery(input: string, books: BookIndex): QueryIntent {
  const trimmed = input.trim();
  if (!trimmed) return { type: "empty" };

  const parsed = tryParseReference(trimmed, books);
  if (parsed) {
    return { type: "reference", slug: toUrlSlug(parsed, books), label: formatRange(parsed, books) };
  }
  return { type: "search", query: trimmed };
}
