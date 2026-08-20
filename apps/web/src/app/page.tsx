import { Wordmark } from "@/components/Wordmark";
import { JumpSearch } from "@/components/home/JumpSearch";
import { ContinueReading } from "@/components/home/ContinueReading";
import { BookBrowser } from "@/components/home/BookBrowser";
import { CorpusDoorways } from "@/components/home/CorpusDoorways";
import { CorpusFacts } from "@/components/home/CorpusFacts";
import { TourLauncher } from "@/components/onboarding/TourLauncher";
import { getAllOmissions } from "@/lib/db/apparatus";
import {
  getBookBrowseIndex,
  getBookIndex,
  getBooks,
  getCrossReferenceCount,
  getMostReferencedVerses,
  getTranslations,
  getVerseCount,
} from "@/lib/db/corpus";
import { formatRange, singleton } from "@/lib/refs";

/**
 * The home page: a working entry point to the corpus, not a marketing page.
 *
 * Server component throughout except the two small islands that need the client (`JumpSearch`
 * for live classification feedback, `ContinueReading` for the localStorage-backed preference) —
 * every number and every doorway below is a real query result, fetched here and handed down as
 * props, never invented in a component.
 */
export default function Home() {
  const translations = getTranslations();
  const defaultTranslation = translations[0];

  const books = getBooks();
  const browseIndex = getBookBrowseIndex();
  const topVerses = getMostReferencedVerses(defaultTranslation.translationId, 6);
  const omissions = getAllOmissions();
  const verseCount = getVerseCount();
  const crossReferenceCount = getCrossReferenceCount();

  // References are formatted here, not in `<CorpusDoorways>`, because the book abbreviation is
  // corpus data and components may not reach for it (AGENTS.md invariant #2). `formatRange` is
  // the single function that turns an address into a reference, so these labels match the ones
  // the reader, the search results and the cross-reference panel show.
  const bookIndex = getBookIndex();
  const doorwayReferences = new Map<number, string>(
    [...topVerses, ...omissions].map((row) => [
      row.verseId,
      formatRange(singleton(row.verseId), bookIndex),
    ]),
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-10 pb-16 lg:py-16">
      {/* Masthead — compact, not a hero. The wordmark and verse are well-liked and stay, but
          they no longer eat the fold: everything below is one scroll away, not a click away. */}
      <header className="flex flex-col items-center gap-3 text-center">
        <Wordmark size="lg" withVerse className="items-center" />
        {/* One sentence saying what this is, and it is not a tagline — it is a list of what is
            actually here, with the numbers queried rather than typed.
            It exists because a reviewer skipped the guided tour, as most people will, and then
            could not find out from the page what the site was: the wordmark, a verse, a search
            box and a "take the tour" button, with every claim about the product locked inside
            the tour the visitor had just dismissed. The `<title>` said "scholarly Bible study";
            the page said nothing.
            The numbers earn their place by being checkable — a reader who doubts the
            cross-reference count can open the panel and count. Keep them queried; a hardcoded
            number here would be the first thing to go stale. */}
        <p className="max-w-prose font-serif text-[var(--text-md)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
          Read the text with the evidence beside it:{" "}
          {translations.length} translations that keep your place when you switch between them,{" "}
          {crossReferenceCount.toLocaleString()} cross-references, the verses the earliest
          manuscripts disagree about, and the Hebrew and Greek word by word.
        </p>
      </header>

      <section aria-label="Jump to a reference or search">
        <JumpSearch books={books} />
        {/* The tour opens by itself on a first visit and is marked seen immediately, so this is
            the way back for everyone who skipped it — and the only way back below 1280px, where
            there is no nav rail to hold the "Guide" cell. */}
        <div className="mt-4 flex justify-center">
          <TourLauncher />
        </div>
      </section>

      <ContinueReading />

      <section id="browse" aria-label="Browse the canon">
        <h2 className="mb-1 font-serif text-[var(--text-lg)] text-[var(--color-ink)]">Browse the canon</h2>
        {/* The 66 pills below are a wall, and the obvious fix — a type-to-filter box on the
            list — would be the SECOND text input on this page doing very nearly the same job
            as the first. `<JumpSearch>` already resolves a typed book name to its reader
            ("Genesis" -> /read/Gen) through the same classifier the /go route runs. Two search
            boxes a screen apart, one navigating and one filtering, is a worse page than one
            box people can find. So this says where the fast path is instead of duplicating it;
            the list stays what it is good at, which is browsing by testament and genre when
            you do not yet know the name you want. */}
        <p className="mb-4 font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          All 66 books, by testament and genre. Know the one you want?{" "}
          <a href="#jump-search" className="text-[var(--color-brand)] underline underline-offset-2">
            Type its name in the box above
          </a>{" "}
          and go straight there.
        </p>
        <BookBrowser books={browseIndex} />
      </section>

      <section id="doorways" aria-label="Ways into the corpus">
        <h2 className="mb-4 font-serif text-[var(--text-lg)] text-[var(--color-ink)]">Ways in</h2>
        <CorpusDoorways
          translationId={defaultTranslation.translationId}
          topVerses={topVerses}
          omissions={omissions}
          references={doorwayReferences}
        />
      </section>

      <section aria-label="About this corpus">
        <h2 className="mb-4 font-serif text-[var(--text-lg)] text-[var(--color-ink)]">What&rsquo;s actually here</h2>
        <CorpusFacts
          translations={translations}
          verseCount={verseCount}
          crossReferenceCount={crossReferenceCount}
        />
      </section>

      <p className="text-center font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
        Building a research tool?{" "}
        <a href="/api" className="text-[var(--color-brand)] underline underline-offset-2">
          Use the public Bible API
        </a>{" "}
        — with OpenAPI and LLM-readable instructions.
      </p>
    </div>
  );
}
