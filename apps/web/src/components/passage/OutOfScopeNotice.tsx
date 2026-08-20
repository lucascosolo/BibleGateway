import Link from "next/link";

/**
 * A passage in a book the current translation does not contain.
 *
 * ONE banner for the passage — not one note per verse. This is the visible half of the
 * `verse_omissions` / `translation_books` split: `/read/John.3?t=JPS` used to render the same
 * 36-word paragraph thirty-six times, once for each verse of a chapter that is not in the JPS
 * TaNaKH at all, under an introduction promising "the verses either side are shown instead"
 * when there are no verses either side and never were. Repeating a sentence per verse is what
 * you get when scope is stored per verse; the sentence is right and the granularity was wrong.
 *
 * Deliberately NOT a 404. The reference is valid, the address exists, and the honest answer to
 * "show me John 3 in the JPS" is not "this page could not be found" — it is that this edition
 * is a translation of a different collection of books, and here is who does print it. The
 * verse-id address space exists precisely so that switching translation never throws a reader
 * off the page, and a 404 here would break that promise on the one route that most needs it.
 *
 * The sentence is composed here rather than stored. It was once written into the database once
 * per verse by the ingest, which is how one sentence became 7,957 rows.
 */

export interface OutOfScopeNoticeProps {
  /** Human reference the reader asked for, e.g. "John 3". */
  reference: string;
  /** Book name alone, e.g. "John" — the subject of the sentence. */
  bookName: string;
  /**
   * Overrides `bookName` as the subject of the heading, for the narrower case where the book IS
   * included and a single verse is not.
   *
   * `/read/Acts.8.37?t=WEB` is that case: WEB prints Acts, and simply has no text for verse 37.
   * Saying "World English Bible does not include Acts" there would be false — and it is the kind
   * of false that a reader can check in one click, which is the worst kind to ship.
   */
  subject?: string;
  translationName: string;
  /** `translations.scope_note`: why this edition covers what it covers. May be empty. */
  scopeNote: string;
  /** Translations that do print this book, with a link landing on the same reference. */
  printedBy: { code: string; name: string }[];
  /** URL slug of the requested reference, so every offer preserves the reader's place. */
  passageSlug: string;
}

export function OutOfScopeNotice({
  reference,
  bookName,
  subject,
  translationName,
  scopeNote,
  printedBy,
  passageSlug,
}: OutOfScopeNoticeProps) {
  return (
    <aside className="out-of-scope" aria-labelledby="out-of-scope-heading">
      <h2 className="out-of-scope__heading" id="out-of-scope-heading">
        {translationName} does not include {subject ?? bookName}
      </h2>

      {/* Not phrased as a fault. This translation is not incomplete — it is a translation of a
          different (smaller) collection of books, and saying so is the interesting true fact
          rather than the apologetic one. */}
      {scopeNote && <p className="out-of-scope__note">{scopeNote}</p>}

      {printedBy.length > 0 && (
        <div className="out-of-scope__offer">
          <p>
            {reference} is printed in {printedBy.length} of the other translations loaded here:
          </p>
          <ul className="out-of-scope__list">
            {printedBy.map((t) => (
              <li key={t.code}>
                {/* Same reference, different translation — the address is
                    translation-independent, so this lands exactly where the reader asked. */}
                <Link href={`/read/${passageSlug}?t=${t.code}`}>
                  <strong>{t.code}</strong> <span>{t.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
