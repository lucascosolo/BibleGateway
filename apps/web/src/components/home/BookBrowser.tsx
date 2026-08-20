import Link from "next/link";
import { groupBooksForBrowse, type BookBrowseEntry } from "@/lib/home/bookGroups";

const TESTAMENT_LABEL: Record<BookBrowseEntry["testament"], string> = {
  OT: "Old Testament",
  NT: "New Testament",
  DC: "Deuterocanon",
};

/** Title-cases a single genre tag for display — the DB stores them lowercase for querying. */
function genreLabel(genre: string): string {
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}

/**
 * Browse the whole canon by testament and genre — grouping computed from the `books.genre`
 * column (`groupBooksForBrowse`, unit tested), never a hand-maintained list, so a future
 * ingest change to genre tagging shows up here automatically.
 */
export function BookBrowser({ books }: { books: BookBrowseEntry[] }) {
  const groups = groupBooksForBrowse(books);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {groups.map((testamentGroup) => (
        <section key={testamentGroup.testament} aria-label={TESTAMENT_LABEL[testamentGroup.testament]}>
          <h3 className="mb-3 font-sans text-[var(--text-sm)] font-semibold text-[var(--color-ink-muted)]">
            {TESTAMENT_LABEL[testamentGroup.testament]}
          </h3>
          <div className="flex flex-col gap-3">
            {testamentGroup.genres.map((genreGroup) => (
              <div key={genreGroup.genre}>
                <h4 className="mb-1.5 font-sans text-[var(--text-xs)] font-medium text-[var(--color-ink-faint)]">
                  {genreLabel(genreGroup.genre)}
                </h4>
                <ul className="flex flex-wrap gap-1.5">
                  {genreGroup.books.map((book) => (
                    <li key={`${genreGroup.genre}-${book.bookId}`}>
                      <Link
                        href={`/read/${book.osisId}`}
                        className="inline-flex min-h-[var(--touch-target)] items-center rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 font-sans text-[var(--text-sm)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]"
                      >
                        {book.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
