"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { PassageRenderer } from "@/components/passage/PassageRenderer";
import { TranslationSwitcherClient } from "@/components/reader/TranslationSwitcherClient";
import type { Translation } from "@/lib/db/corpus";
import { getLexiconEntry, glossFor } from "@/lib/lexicon";
import { usePreferencesStore } from "@/lib/store/preferences";
import { BookIndex, formatRange, toUrlSlug, type BookRecord } from "@/lib/refs";
import type { VerseId } from "@/lib/refs/verse-id";
import { classifySearchQuery } from "@/lib/search/query";
import type {
  OriginalSearchApiResponse,
  SearchApiHit,
  SearchApiResponse,
} from "@/lib/search/types";

export interface DerashSearchProps {
  books: BookRecord[];
  translations: Translation[];
}

type Testament = "OT" | "NT" | "DC";
type SearchMode = "text" | "original";
const TESTAMENT_LABEL: Record<Testament, string> = { OT: "Old Testament", NT: "New Testament", DC: "Deuterocanon" };

const LIMIT = 20;

/**
 * The search field, filters, and results — the client half of `/derash`.
 *
 * The URL is the source of truth for every parameter that defines "what search is this"
 * (`q`, `t`, `testament`, `book`, `offset`), exactly like the reader keeps translation as a
 * query param rather than component state: it is what makes a result linkable, shareable, and
 * navigable with back/forward, and it means a page refresh reproduces the exact same search
 * instead of an empty field.
 */
export function DerashSearch({ books, translations }: DerashSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bookIndex = useMemo(() => new BookIndex(books), [books]);
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const derash = getLexiconEntry("derash");

  const q = searchParams.get("q") ?? "";
  const mode: SearchMode = searchParams.get("mode") === "original" ? "original" : "text";
  const originalLanguage = searchParams.get("language") ?? "";
  const originalMorph = searchParams.get("morph") ?? "";
  const translationCode = searchParams.get("t") ?? translations[0]?.code ?? "WEB";
  const availableTestaments = useMemo(() => {
    const present = new Set(books.map((b) => b.testament));
    return (["OT", "NT", "DC"] as Testament[]).filter((t) => present.has(t));
  }, [books]);

  const testamentParam = searchParams.get("testament");
  const testament: Testament | null =
    testamentParam === "OT" || testamentParam === "NT" || testamentParam === "DC" ? testamentParam : null;
  const bookParam = searchParams.get("book");
  const bookId = bookParam ? Number.parseInt(bookParam, 10) : null;
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const translation = translations.find((t) => t.code === translationCode) ?? translations[0];

  // The text field is local state, separate from `q` in the URL, so typing doesn't refetch or
  // rewrite history on every keystroke — only committing (Enter / submit) does.
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const [data, setData] = useState<SearchApiResponse | OriginalSearchApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim() || !translation) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ q, translation: translation.code, limit: String(LIMIT), offset: String(offset) });
    const endpoint = mode === "original" ? "/api/original-search" : "/api/search";
    if (mode === "original") {
      if (originalLanguage) params.set("language", originalLanguage);
      if (originalMorph.trim()) params.set("morph", originalMorph.trim());
    } else {
      if (testament) params.set("testament", testament);
      if (bookId) params.set("book", String(bookId));
    }

    fetch(`${endpoint}?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`search request failed (${res.status})`);
        return res.json() as Promise<SearchApiResponse | OriginalSearchApiResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q, translation, testament, bookId, offset, mode, originalLanguage, originalMorph]);

  // A researcher typing "Rom 8:28" wants the passage, not a word match — classify against
  // the COMMITTED query (not the live draft) so the banner doesn't flicker mid-keystroke.
  const classification = useMemo(() => classifySearchQuery(q, bookIndex), [q, bookIndex]);

  function updateParams(patch: Record<string, string | null>, opts: { push?: boolean } = {}) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const url = `${pathname}?${next}`;
    if (opts.push) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // A new query is a new place to come back to — pushed, not replaced, so the back button
    // steps through search history the way it does for regular navigation.
    updateParams({ q: draft.trim() || null, offset: null }, { push: true });
  }

  const hasQuery = q.trim().length > 0;

  return (
    <section className="derash" aria-label="Search">
      <header className="derash__header">
        {/* Not `<GlossLabel>`: that renders a span/strong with a tooltip trigger, and this is
            the page's `<h1>`. The lookup is the same one, so "Plain labels" reaches here — it
            did not before, because both the term and its gloss were typed out inline. The
            gloss now comes from `lib/lexicon.ts` too, so the honest description of what this
            search is and is not cannot drift from the one the rest of the app shows. */}
        <h1 className="derash__title">{plainLabels ? derash.plainLabel : derash.term}</h1>
        <p className="derash__gloss">{glossFor(derash, plainLabels)}</p>
      </header>

      <form className="derash__form" onSubmit={onSubmit} role="search">
        <input
          type="search"
          name="q"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search the text, or jump to a reference (John 3:16, Rom 8)…"
          className="derash__input"
          aria-label="Search query"
        />
        <button type="submit" className="derash__submit">
          Search
        </button>
      </form>

      <div className="derash__mode" role="group" aria-label="Search source">
        <button type="button" aria-pressed={mode === "text"} className={clsx("derash__mode-button", mode === "text" && "derash__mode-button--active")} onClick={() => updateParams({ mode: null, offset: null })}>
          English text
        </button>
        <button type="button" aria-pressed={mode === "original"} className={clsx("derash__mode-button", mode === "original" && "derash__mode-button--active")} onClick={() => updateParams({ mode: "original", testament: null, book: null, offset: null })}>
          Original language
        </button>
      </div>

      {mode === "original" && (
        <div className="derash__original-filters" role="group" aria-label="Original-language filters">
          <label>
            Language
            <select value={originalLanguage} onChange={(e) => updateParams({ language: e.target.value || null, offset: null })}>
              <option value="">All</option>
              <option value="hbo">Biblical Hebrew</option>
              <option value="arc">Biblical Aramaic</option>
              <option value="grc">Koine Greek</option>
            </select>
          </label>
          <label>
            Morphology prefix
            <input value={originalMorph} onChange={(e) => updateParams({ morph: e.target.value || null, offset: null })} placeholder="V… or N…" />
          </label>
        </div>
      )}

      {translations.length > 1 && translation && (
        <TranslationSwitcherClient
          translations={translations}
          active={translation}
          onSelect={(code) => updateParams({ t: code })}
        />
      )}

      {mode === "text" && classification.mode === "reference" && (
        <Link
          href={`/read/${toUrlSlug(classification.reference, bookIndex)}?t=${translationCode}`}
          className="derash__ref-banner"
        >
          <span className="derash__ref-banner-label">Go to passage</span>
          <span className="derash__ref-banner-ref">{formatRange(classification.reference, bookIndex)}</span>
        </Link>
      )}

      {hasQuery && mode === "text" && (
        <div className="derash__filters" role="group" aria-label="Filters">
          <div className="derash__filter-group">
            {/* Derived from the loaded canon, not hard-coded. The corpus is 39 OT + 27 NT
                books with no deuterocanon, and offering a Deuterocanon filter that can never
                match anything is a promise the tool cannot keep. */}
            {availableTestaments.map((t) => (
              <button
                key={t}
                type="button"
                className={clsx("derash__filter", testament === t && "derash__filter--active")}
                aria-pressed={testament === t}
                onClick={() => updateParams({ testament: testament === t ? null : t, book: null, offset: null })}
              >
                {TESTAMENT_LABEL[t]}
              </button>
            ))}
          </div>

          <select
            className="derash__book-select"
            aria-label="Filter by book"
            value={bookId ?? ""}
            onChange={(e) => updateParams({ book: e.target.value || null, offset: null })}
          >
            <option value="">All books</option>
            {books
              .filter((b) => !testament || b.testament === testament)
              .map((b) => (
                <option key={b.bookId} value={b.bookId}>
                  {b.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {!hasQuery && (
        <p className="derash__idle">
          {mode === "original"
            ? "Type a lemma, pointed word, or Strong’s number. Add a language or morphology prefix to narrow the evidence."
            : "Type one or more words or a reference above. Multiple words all must appear in the verse, but not adjacently — this is not exact-phrase search."}
        </p>
      )}

      {hasQuery && loading && !data && <p className="derash__loading">Searching…</p>}
      {hasQuery && error && <p className="derash__error">Could not search: {error}</p>}

      {hasQuery && data && data.total === 0 && (
        <p className="derash__empty">
          No matches for &ldquo;{data.query}&rdquo;
          {testament ? ` in the ${TESTAMENT_LABEL[testament].toLowerCase()}` : ""}
          {bookId ? ` of ${books.find((b) => b.bookId === bookId)?.name}` : ""}.
        </p>
      )}

      {hasQuery && data && data.total > 0 && translation && (
        <>
          {/* Count first, then the distribution, then the results. The distribution is the
              more interesting object, but a researcher who has just typed a query wants to
              know how many matches there are and to start reading them — leading with a
              twelve-row chart pushed the first result below the fold on a laptop. */}
          <p className="derash__count">
            {data.offset + 1}–{Math.min(data.offset + data.returned, data.total)} of {data.total} match
            {data.total === 1 ? "" : "es"} in {translation.code}
          </p>

          <BookDistribution
            distribution={data.bookDistribution}
            activeBookId={bookId}
            onSelect={(id) => updateParams({ book: id === bookId ? null : String(id), offset: null })}
          />

          <ol className="derash__results">
            {data.hits.map((hit) => (
              <ResultRow key={hit.verseId} hit={hit} translation={translation} bookIndex={bookIndex} />
            ))}
          </ol>

          <nav className="derash__pager" aria-label="Result pages">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => updateParams({ offset: String(Math.max(0, offset - LIMIT)) })}
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={data.offset + data.returned >= data.total}
              onClick={() => updateParams({ offset: String(offset + LIMIT) })}
            >
              Next →
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

function ResultRow({
  hit,
  translation,
  bookIndex,
}: {
  hit: SearchApiHit;
  translation: Translation;
  bookIndex: BookIndex;
}) {
  const verseId = hit.verseId as VerseId;
  const range = { start: verseId, end: verseId };
  const highlights = useMemo(() => new Map([[verseId, hit.matches]]), [verseId, hit.matches]);

  return (
    <li className="derash-row">
      <Link href={`/read/${toUrlSlug(range, bookIndex)}?t=${translation.code}#v${verseId}`} className="derash-row__link">
        <span className="derash-row__reference">{formatRange(range, bookIndex)}</span>
        {hit.original && (
          <span className="derash-row__original" lang={hit.original.language}>
            {hit.original.surface} · {hit.original.lemma} · {hit.original.morph}
          </span>
        )}
        <PassageRenderer
          verses={[
            {
              verseId,
              chapter: hit.chapter,
              verse: hit.verse,
              text: hit.text,
              heatBucket: hit.heatBucket,
            },
          ]}
          range={range}
          density="preview"
          translationId={translation.translationId}
          layerOverrides={{ highlights: false, notes: false, crossRefs: false, heat: false }}
          searchHighlights={highlights}
          className="derash-row__preview"
        />
      </Link>
    </li>
  );
}

function BookDistribution({
  distribution,
  activeBookId,
  onSelect,
}: {
  distribution: SearchApiResponse["bookDistribution"];
  activeBookId: number | null;
  onSelect: (bookId: number) => void;
}) {
  if (distribution.length === 0) return null;
  const max = Math.max(...distribution.map((d) => d.count));
  const shown = distribution.slice(0, 6);

  return (
    <div className="derash-dist" aria-label="Distribution of matches across books">
      <h2 className="derash-dist__title">Where this clusters</h2>
      <ul className="derash-dist__bars">
        {shown.map((d) => (
          <li key={d.bookId}>
            <button
              type="button"
              className={clsx("derash-dist__bar", activeBookId === d.bookId && "derash-dist__bar--active")}
              onClick={() => onSelect(d.bookId)}
              aria-pressed={activeBookId === d.bookId}
            >
              <span className="derash-dist__bar-label">{d.bookName}</span>
              <span className="derash-dist__bar-track">
                <span className="derash-dist__bar-fill" style={{ width: `${Math.max(6, (d.count / max) * 100)}%` }} />
              </span>
              <span className="derash-dist__bar-count">{d.count}</span>
            </button>
          </li>
        ))}
      </ul>
      {distribution.length > shown.length && (
        <p className="derash-dist__truncation">
          Showing the top {shown.length} of {distribution.length} books with a match.
        </p>
      )}
    </div>
  );
}
