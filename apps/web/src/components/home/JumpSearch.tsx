"use client";

import { useMemo, useState } from "react";
import { BookIndex, classifyQuery, type BookRecord } from "@/lib/refs";
import { usePreferencesStore } from "@/lib/store/preferences";

interface JumpSearchProps {
  /** The 66-row canon, passed down from the server so this can classify without a round trip. */
  books: BookRecord[];
}

/**
 * The primary action on the home page: type a reference or a phrase, get the right surface.
 *
 * Submits as a plain GET to `/go`, which runs the identical `classifyQuery` server-side — so
 * this works with JavaScript disabled (the browser does the navigation itself) and, when JS
 * *is* available, shows the same classification as a live preview before the user commits.
 * One classifier, never two implementations that could disagree.
 */
export function JumpSearch({ books }: JumpSearchProps) {
  const index = useMemo(() => new BookIndex(books), [books]);
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const [value, setValue] = useState("");
  const intent = useMemo(() => classifyQuery(value, index), [value, index]);

  return (
    <form
      action="/go"
      method="get"
      role="search"
      className="flex w-full flex-col gap-2"
    >
      <div className="flex w-full items-stretch gap-2">
        <label htmlFor="jump-search" className="sr-only">
          Jump to a reference, or search the corpus
        </label>
        <input
          id="jump-search"
          name="q"
          aria-label="Jump to a reference, or search the corpus"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="John 3:16, Rom 8, or “born again”"
          autoComplete="off"
          spellCheck={false}
          className="h-12 min-w-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 font-sans text-[var(--text-base)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-[var(--radius-lg)] bg-[var(--color-brand-strong)] px-5 font-sans text-[var(--text-sm)] font-semibold text-on-accent transition-opacity hover:opacity-90"
        >
          Go
        </button>
      </div>
      <p aria-live="polite" className="min-h-[1.5em] px-1 font-sans text-[var(--text-xs)] text-[var(--color-ink-faint)]">
        {intent.type === "reference" && (
          <>
            → Jump straight to <strong className="text-[var(--color-ink-muted)]">{intent.label}</strong>
          </>
        )}
        {intent.type === "search" && (
          <>
            {/* Two whole phrasings rather than substituting the label into one: "Search Search
                for" is what a naive swap produces, and the plain-labels preference has to read
                like English, not like a template with a variable in it. */}
            → {plainLabels ? "Search the text for" : "Search Derash for"}{" "}
            <strong className="text-[var(--color-ink-muted)]">&ldquo;{intent.query}&rdquo;</strong>
          </>
        )}
        {intent.type === "empty" && (
          <>Type a reference (John 3:16, Rom 8) or one or more words to search — matches don&rsquo;t need to be adjacent.</>
        )}
      </p>
    </form>
  );
}
