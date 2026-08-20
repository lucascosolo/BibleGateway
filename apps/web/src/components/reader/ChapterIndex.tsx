"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import type { ChapterSummary } from "@/lib/db/corpus";

/**
 * What a book-sized reference opens as.
 *
 * A book is not a passage. `/read/Ps` used to render every verse of Psalms into one document:
 * 1,085,491 bytes of HTML, 2,461 mounted verse components and 2,461 atom subscriptions, with
 * verse numbers restarting 150 times and nothing on the page marking where. It was slower
 * than the corpus and less readable than a printed index.
 *
 * The alternative was a virtualized continuous reader. It was rejected, and the reason is
 * structural rather than budgetary: the reader is a *server component* today, and its passage
 * text streams as static markup that never waits on client-side data. Virtualizing it means
 * the scripture can only exist after hydration, in a client component, measured — which
 * trades the property the whole reading surface is built on for scrolling through a book
 * nobody reads front-to-back in one sitting. Scholarly reading is addressed, not linear: a
 * researcher arrives at Psalm 51, not at Psalms.
 *
 * So a book resolves to its chapters, with the real verse counts stated. Every chapter is one
 * click away, the boundaries are the navigation, and a book link costs a few kilobytes.
 * Multi-chapter *passages* below the reader's span limit still render continuously, with
 * chapter headings — see `PassageRenderer`.
 *
 * ---
 *
 * This is a client component, and the reason is the filter below. `/read/Ps` is a wall of 150
 * identical buttons: it is responsive and it is fully accessible and it is still the slowest
 * possible way to reach Psalm 119, because the only tool it offered was the reader's own eyes
 * scanning a grid of numbers. Typing "119" is one gesture.
 *
 * The cost is bounded and was checked before paying it: the props are the chapter summaries
 * that were already being serialized into the RSC payload to render the links — 150 rows of
 * four small fields for the largest book in the corpus. Nothing new crosses the wire, and no
 * scripture does. The passage reader itself remains a server component; this is the index, not
 * the text.
 *
 * The filter deliberately matches on the chapter NUMBER, not on a title — chapters do not have
 * titles here, and matching a substring means "1" surfaces 1, 10–19, 100–150, which is the
 * behaviour a numeric jump list wants. Enter on an exact match navigates straight there, so
 * the common case is type-two-digits-and-go without ever touching the grid.
 */

export interface ChapterIndexProps {
  chapters: readonly ChapterSummary[];
  /** Preserved on every chapter link, so choosing a chapter keeps the chosen translation. */
  translationCode: string;
  /** How the reference was written, for the heading. */
  label: string;
}

export function ChapterIndex({ chapters, translationCode, label }: ChapterIndexProps) {
  const router = useRouter();
  const filterId = useId();
  const [query, setQuery] = useState("");

  const trimmed = query.trim();

  const books = useMemo(() => {
    const grouped: { osisId: string; bookName: string; chapters: ChapterSummary[] }[] = [];
    for (const chapter of chapters) {
      const last = grouped[grouped.length - 1];
      if (last && last.osisId === chapter.osisId) last.chapters.push(chapter);
      else grouped.push({ osisId: chapter.osisId, bookName: chapter.bookName, chapters: [chapter] });
    }
    return grouped;
  }, [chapters]);

  const verseTotal = useMemo(
    () => chapters.reduce((sum, c) => sum + c.verseCount, 0),
    [chapters],
  );

  // A multi-book index (a range spanning books) can also be filtered by book name; a
  // single-book one cannot, because every row would match and the filter would look broken.
  const matches = useMemo(() => {
    if (!trimmed) return books;
    const needle = trimmed.toLowerCase();
    return books
      .map((book) => ({
        ...book,
        chapters: book.chapters.filter(
          (c) =>
            String(c.chapter).includes(needle) ||
            (books.length > 1 && book.bookName.toLowerCase().includes(needle)),
        ),
      }))
      .filter((book) => book.chapters.length > 0);
  }, [books, trimmed]);

  const shownCount = matches.reduce((sum, b) => sum + b.chapters.length, 0);

  /**
   * Enter goes straight to the chapter when the query names exactly one.
   *
   * "Exactly one" is the whole condition — pressing Enter on "1" in Psalms would otherwise be a
   * coin toss between 1, 10 and 100. When it is ambiguous the grid below is already filtered to
   * the candidates, so Enter doing nothing is not a dead end.
   */
  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (shownCount !== 1) return;
    const book = matches[0];
    const chapter = book.chapters[0];
    router.push(`/read/${book.osisId}.${chapter.chapter}?t=${translationCode}`);
  }

  return (
    <div className="chapter-index">
      <header className="chapter-index__header">
        <h1 className="chapter-index__title">{label}</h1>
        {/* Stated plainly and in a neutral voice: this is the size of what was asked for, not
            a warning that something went wrong. */}
        <p className="chapter-index__lede">
          {chapters.length.toLocaleString()} chapters, {verseTotal.toLocaleString()} verses.
          Choose a chapter to read.
        </p>

        <form className="chapter-index__filter" role="search" onSubmit={onSubmit}>
          <label className="chapter-index__filter-label" htmlFor={filterId}>
            Jump to a chapter
          </label>
          <input
            id={filterId}
            className="chapter-index__filter-input"
            type="search"
            inputMode="numeric"
            autoComplete="off"
            placeholder={books.length > 1 ? "Number or book name" : "Chapter number"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {/* Politely, not assertively: this updates on every keystroke and an assertive region
              would interrupt the user mid-word on every one of them. */}
          <p className="chapter-index__filter-status" aria-live="polite">
            {trimmed
              ? `${shownCount} of ${chapters.length} chapters match${shownCount === 1 ? " — press Enter to open it" : ""}`
              : ""}
          </p>
        </form>
      </header>

      {shownCount === 0 && (
        <p className="chapter-index__empty">
          No chapter matches &ldquo;{trimmed}&rdquo;. This reference has{" "}
          {chapters.length.toLocaleString()} chapters.
        </p>
      )}

      {matches.map((book) => (
        <section
          key={book.osisId}
          className="chapter-index__book"
          aria-label={`${book.bookName} chapters`}
        >
          {books.length > 1 && <h2 className="chapter-index__book-title">{book.bookName}</h2>}
          <ul className="chapter-index__grid">
            {book.chapters.map((chapter) => (
              <li key={`${book.osisId}.${chapter.chapter}`}>
                <Link
                  className="chapter-index__chapter"
                  href={`/read/${book.osisId}.${chapter.chapter}?t=${translationCode}`}
                  // The verse count is the useful disambiguator between two chapter numbers,
                  // and it is a real count from the corpus rather than a nominal one.
                  aria-label={`${book.bookName} ${chapter.chapter}, ${chapter.verseCount} verses`}
                >
                  {chapter.chapter}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
