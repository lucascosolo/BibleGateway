import { Suspense } from "react";

import { getBookIndex, getTranslations } from "@/lib/db/corpus";
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
export const metadata = {
  title: "Derash · Jot",
};

export default async function DerashPage() {
  const books = getBookIndex().all;
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
