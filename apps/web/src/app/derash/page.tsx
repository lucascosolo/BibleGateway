import { shareMetadata } from "@/app/og/data";
import { excerpt } from "@/lib/seo";
import { Suspense } from "react";

import { getOutsideBookIndex, getTranslations } from "@/lib/db/corpus";
import { DerashSearch } from "./DerashSearch";

/**
 * Derash — "to seek out" (ARCHITECTURE.md §4.6). Full-text search over the corpus.
 *
 * A server component only to the extent of handing the client the two small, immutable
 * lookup tables it needs (books, translations) without shipping the corpus query layer
 * itself — the actual search is entirely client-driven, because the query string IS the
 * page's state (linkable, back/forward-able) and every keystroke-to-URL-to-refetch loop is
 * inherently a client concern.
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  // A shared search link should say what was searched. The canonical stays `/derash`: result
  // pages are a view of the query, not documents of their own.
  const q = (await searchParams).q?.trim();
  if (!q) {
    return shareMetadata('Bible text search (Derash) · Jot', 'Search Bible translations by word or phrase and explore matching verses and their distribution across books.', '/derash', { card: { kind: "page", page: "derash" } });
  }
  const shown = excerpt(q, 60);
  return {
    ...shareMetadata(`“${shown}” — Bible search · Jot`, `Every verse matching “${shown}” across the Bible translations in Jot, with where it falls book by book.`, '/derash', {
      card: { kind: "page", page: "derash", query: q },
    }),
    robots: { index: false, follow: true },
  };
}

export default async function DerashPage() {
  const books = getOutsideBookIndex().all;
  const translations = getTranslations();

  return (
    <div className="derash-page">
      {/* `useSearchParams` (the query string is this page's whole state) opts the subtree out
          of static rendering unless it's inside a Suspense boundary — this fallback is what a
          direct link to /derash?q=... shows for the one frame before hydration. */}
      <Suspense fallback={<p className="derash__loading">Loading search…</p>}>
        <DerashSearch books={books} translations={translations} />
      </Suspense>
    </div>
  );
}
