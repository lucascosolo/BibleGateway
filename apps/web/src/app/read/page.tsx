import { BookBrowser } from "@/components/home/BookBrowser";
import { getBookBrowseIndex } from "@/lib/db/corpus";

/**
 * `/read` with no reference — the destination of the "Read" nav item.
 *
 * This route existed in the navigation before it existed on disk, so the first item in the
 * primary nav 404'd. It could have been a redirect to some default chapter, but picking one
 * for the reader is a decision the tool has no business making: opening at Genesis 1 every
 * time is a worse answer than asking which passage they want.
 *
 * So it is the canon itself, browsable. Continue-reading lives on the home page, where it can
 * read client-side state; this page is the deliberate "open something specific" surface.
 */
export const metadata = {
  title: "Read · Jot",
  description: "Open any passage in the biblical canon.",
};

export default function ReadIndexPage() {
  const books = getBookBrowseIndex();

  return (
    <div className="reader-index">
      <header className="reader-index__header">
        <h1 className="reader-index__title">Read</h1>
        <p className="reader-index__lede">
          Open any book of the canon. Every passage keeps its address across translations, so
          switching between them never loses your place.
        </p>
      </header>

      <BookBrowser books={books} />
    </div>
  );
}
