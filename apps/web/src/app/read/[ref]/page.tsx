import { StructuredData } from "@/app/_components/StructuredData";
import { hasEditionContent } from "@/lib/db/discovery";
import { canonicalReferenceSlug } from "@/lib/seo";
import { passageSnapshot, quoteLine, shareMetadata } from "@/app/og/data";
import { ReferenceLinks } from "@/app/_components/ReferenceLinks";
import { CrossRefLayer } from "@/components/crossrefs/CrossRefLayer";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CrossRefAside } from "@/components/crossrefs/CrossRefAside";
import { OutOfScopeNotice } from "@/components/passage/OutOfScopeNotice";
import { PassageRenderer } from "@/components/passage/PassageRenderer";
import { ChapterIndex } from "@/components/reader/ChapterIndex";
import { CiteButton } from "@/components/reader/CiteButton";
import { ReaderShortcuts } from "@/components/reader/ReaderShortcuts";
import { TranslationSwitcher } from "@/components/reader/TranslationSwitcher";
import {
  getBookScope,
  getOmissions,
  getTranslationsPrintingBook,
  getTranslationsPrintingVerse,
} from "@/lib/db/apparatus";
import { getCorpusBuildId } from "@/lib/db/client";
import {
  getOutsideBookIndex,
  getChapterCount,
  getChapterLastVerse,
  getChapterSummary,
  getExistingVerseIds,
  getPassage,
  getTranslationByCode,
  getTranslations,
} from "@/lib/db/corpus";
import {
  getInterlinear,
  getOriginalVariants,
  getGreekEditionVariants,
  getGreekManuscriptReadings,
  type OriginalVariant,
  type OriginalWord,
} from "@/lib/db/originals";
import { getInsightNotes, type InsightNote } from "@/lib/insights/notes";
import { getTimelineBuildId, getTimelineNotesForRange, getWork, getWorksForBook, type ToledotNote } from "@/lib/db/timeline";
import { getOutsideBook } from "@/lib/db/outside";
import { CanonNotice } from "@/components/chitzonim/CanonNotice";
import { OutsideWorld } from "@/components/chitzonim/OutsideWorld";
import { canonNotice, carryingTranslations, parallelPair, isOutsideBook, numberingRangeLabel } from "@/lib/chitzonim/outside";
import { labelVerses } from "@/lib/db/timeline-present";
import {
  InvalidReferenceError,
  bookOf,
  chapterOf,
  chapterSpan,
  formatRange,
  parseReference,
  toVerseId,
  type VerseId,
  type VerseRange,
  verseOf,
} from "@/lib/refs";
import { ReaderInteractions } from "./ReaderInteractions";
import { CompareIcon, NoteIcon } from "@/components/audio/icons";
import { ListenButton } from "@/components/audio/ListenButton";
import { ReaderAudio } from "@/components/audio/ReaderAudio";
import { availableChoices, translationsWithAudio } from "@/lib/audio/select";
import { getPassageAudio, getWordClips } from "@/lib/db/audio";

/**
 * The reader.
 *
 * A server component: the passage text is fetched on the server and streamed, so the corpus
 * never ships to the client. Annotations hydrate separately on the client, because they are
 * per-user and must not be cached at the edge with the text.
 */

/**
 * How many chapters the reader will render as one continuous passage.
 *
 * Beyond this a reference is treated as a container to browse rather than a passage to read,
 * and resolves to `<ChapterIndex>`. Three chapters is above every ordinary reading unit (a
 * pericope, a psalm, an epistle chapter) and below anything that produces a document too
 * large to read or to ship: the longest single chapter in the corpus is Psalm 119 at 176
 * verses, so the worst case here stays in the hundreds of verses rather than the thousands.
 */
const MAX_READER_CHAPTERS = 3;

interface ReaderPageProps {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ t?: string }>;
}

export async function generateMetadata({ params, searchParams }: ReaderPageProps) {
  const { ref } = await params;
  const { t } = await searchParams;
  const books = getOutsideBookIndex();
  let range;
  try {
    range = parseReference(decodeURIComponent(ref), books);
  } catch {
    notFound();
  }
  const translation = getTranslationByCode(t ?? defaultTranslationFor(bookOf(range.start) as number));
  if (!translation) notFound();
  if (getExistingVerseIds(range).length === 0) notFound();
  const label = formatRange(range, books);
  const available = hasEditionContent(range.start, range.end, translation.translationId);
  const slug = canonicalReferenceSlug(range, books);
  // The verse IS the preview: a shared John 3:16 should unfurl saying John 3:16, in the
  // translation the sender was reading.
  const snapshot = available ? passageSnapshot(slug, translation.code) : null;
  return {
    ...shareMetadata(
      `${label} ${translation.code} — Bible text & cross-references · Jot`,
      available
        ? `Study ${label} in the ${translation.name} (${translation.code}): Bible cross-references, Hebrew and Greek word study, translation comparison and textual notes.`
        : `${label} is not available in ${translation.name}. Find editions that include this passage on Jot.`,
      `/read/${slug}?t=${translation.code}`,
      {
        card: available ? { kind: "passage", ref: slug, t: translation.code } : { kind: "page", page: "read" },
        shareTitle: `${label} (${translation.code})`,
        shareDescription: snapshot
          ? `“${quoteLine(snapshot, 180)}” — ${label}, ${translation.name}`
          : undefined,
        imageAlt: snapshot ? `${label} in the ${translation.name}: “${quoteLine(snapshot, 240)}”` : undefined,
      },
    ),
    ...(!available ? { robots: { index: false, follow: true } } : {}),
  };
}

/** WEB for the 66; for an outside book, the first edition that prints it. */
function defaultTranslationFor(bookId: number): string {
  return (isOutsideBook(bookId) && getOutsideBook(bookId)?.translations[0]) || "WEB";
}

/** Who holds the book canonical, from its work record when chunk 5's record exists. */
function holdersFor(bookId: number): string[] {
  const work = getWorksForBook(bookId)[0];
  return work ? (getWork(work.id)?.heldCanonicalBy.map((h) => h.tradition) ?? []) : [];
}

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
  const { ref } = await params;
  const { t } = await searchParams;

  // Every book, 67+ included: an outside book is addressed and rendered exactly like the 66.
  const books = getOutsideBookIndex();

  let range;
  try {
    range = parseReference(decodeURIComponent(ref), books);
  } catch (error) {
    if (error instanceof InvalidReferenceError) notFound();
    throw error;
  }

  const realVerses = getExistingVerseIds(range);
  if (realVerses.length === 0) notFound();

  // An outside book steps into its own world (scoped tokens), says who reads it, and offers
  // only the translations that print it. The 66 never list the outside-only editions.
  const firstBookId = bookOf(range.start) as number;
  const outsideBook = isOutsideBook(firstBookId) ? getOutsideBook(firstBookId) : undefined;
  const translations = outsideBook
    ? carryingTranslations(getTranslations(), outsideBook.translations)
    : carryingTranslations(
        getTranslations().filter((x) => x.scope !== "outside"),
        getTranslationsPrintingBook(firstBookId, 0).map((x) => x.code),
      );
  const canonLine = outsideBook ? (
    <CanonNotice
      notice={canonNotice(outsideBook.canon, holdersFor(firstBookId))}
      numbering={numberingRangeLabel(
        outsideBook.numbering,
        outsideBook.osisId,
        { chapter: chapterOf(realVerses[0]), verse: verseOf(realVerses[0]) },
        { chapter: chapterOf(realVerses[realVerses.length - 1]), verse: verseOf(realVerses[realVerses.length - 1]) },
      )}
    />
  ) : null;

  // Translation is a query param, not part of the path, so switching it preserves position:
  // the verse address in the path is translation-independent by construction.
  const translation = getTranslationByCode(t ?? defaultTranslationFor(firstBookId));
  if (!translation) notFound();
  // The compare link opens with the edition on screen and a second one that carries this book.
  const second = parallelPair(translations, translation.code).right;
  const compareHref = `/parallel/${canonicalReferenceSlug(range, books)}?a=${translation.code}${second ? `&b=${second.code}` : ""}`;

  // A book-sized reference is a container, not a passage. Decided before any text is fetched,
  // so `/read/Ps` never loads 2,461 verses in order to discover it should not have rendered
  // them.
  //
  // Two steps, because neither alone is right. The encoded span is free but coarse: a whole
  // book is addressed as chapters 1–999 regardless of how many it has, so Jude — one chapter,
  // 25 verses — would be sent to an index holding a single link. The real chapter list settles
  // it, and is only queried when the cheap bound has already failed. Real chapters are always
  // a subset of the encoded span, so skipping the query below the threshold cannot be wrong.
  const chapters =
    chapterSpan(range) > MAX_READER_CHAPTERS ? getChapterSummary(range) : [];
  if (chapters.length > MAX_READER_CHAPTERS) {
    return (
      // NOT `.reader-layout`: that is a two-column grid whose first track is sized for a
      // measure-capped prose column and whose second holds the cross-reference aside. A
      // chapter grid is neither — dropped into it as an only child, the track resolved
      // against its own indefinite width and the 150-chapter grid collapsed to six columns
      // in a page that had room for sixteen.
      <OutsideWorld bookId={firstBookId}><div className="reader-index-shell">
        <ChapterIndex
          chapters={chapters}
          translationCode={translation.code}
          label={formatRange(range, books)}
        />
      </div></OutsideWorld>
    );
  }

  const bookId = bookOf(range.start) as number;
  const book = books.get(bookId);
  const chapter = chapterOf(range.start);

  /**
   * Scope is settled BEFORE any text is fetched, because "this translation has no text here"
   * has two causes and they get opposite answers.
   *
   * A book this edition does not include is a fact about the edition: the reference is valid,
   * the address is real, and the reader gets one banner naming the translations that do print
   * it. A verse the earliest manuscripts do not contain is a fact about textual transmission
   * and renders in place, in the gap, as apparatus. Those two facts lived in the same table
   * once; the reader showed the manuscript explanation thirty-six times on a chapter that is
   * simply not in the JPS TaNaKH.
   *
   * Both endpoints, so a range that reaches from an included book into an excluded one still
   * renders the half that exists rather than being replaced wholesale by a banner.
   */
  const endBookId = bookOf(range.end) as number;
  const wholeRangeOutOfScope =
    getBookScope(bookId, translation.translationId) === "out_of_scope" &&
    getBookScope(endBookId, translation.translationId) === "out_of_scope";

  if (wholeRangeOutOfScope) {
    return (
      <OutsideWorld bookId={firstBookId}><div className="reader-layout">
        <article className="reader">
          <header className="reader__header">
            <h1 className="reader__title">{formatRange(range, books)}</h1>
        {canonLine}
            <TranslationSwitcher
              translations={translations}
              active={translation}
              hrefFor={(code) => `/read/${canonicalReferenceSlug(range, books)}?t=${code}`}
              linkProps={{ replace: true, scroll: false }}
            />
          </header>

          <OutOfScopeNotice
            reference={formatRange(range, books)}
            bookName={book?.name ?? formatRange(range, books)}
            translationName={translation.name}
            scopeNote={translation.scopeNote}
            printedBy={getTranslationsPrintingBook(bookId, translation.translationId)}
            passageSlug={canonicalReferenceSlug(range, books)}
          />

          {/* The licence line still travels with the page: a licensor audits for it, and the
              reader is still looking at a page about this translation even though it has no
              scripture on it. */}
          <footer className="reader__copyright">
            <p>
              <strong>{translation.name}</strong> ({translation.code}).{" "}
              {translation.copyrightNotice}
            </p>
          </footer>
        </article>
      </div></OutsideWorld>
    );
  }

  const requestedVerses = getPassage(range, translation.translationId);

  // Verses this translation declines to print. Passed into the renderer rather than shown
  // beside it, because the note only makes sense in the gap it explains.
  const requestedOmissions = getOmissions(range, translation.translationId);

  // 404 only when the reference resolves to NOTHING — no printed text and no recorded
  // omission. Rejecting on `verses.length === 0` alone made `/read/John.5.4?t=BSB` a 404
  // while `?t=WEB` was a 200, so switching translation on any of the twelve omitted verses
  // threw the reader off the page instead of preserving their place: the exact claim the
  // verse-id address space exists to make true. A range that prints nothing but records an
  // omission has apparatus to render, and that apparatus is the most legible piece of textual
  // criticism in the corpus.
  // 404 only when the reference resolves to nothing IN THE CANON. A range that exists in
  // `verses` but is empty in this one edition is not a bad reference, and answering it with a
  // 404 tells the reader they typed something wrong when they did not.
  //
  // The guard used to be `verses.length === 0 && omissions.size === 0`, which assumed every
  // absence is either printed text or a recorded omission. There is a third case, and it was
  // live: the ingest records an omission only where its source supplies an empty string, so a
  // source that simply skips a verse leaves no row at all. WEB does that for Acts 8:37 and
  // Acts 15:34 — `/read/Acts.8.37?t=WEB` was a 404 while `?t=KJV` was a 200, on a verse both
  // the canon and five other editions here contain. That breaks the one promise the verse-id
  // address space exists to make: your place survives a change of translation.
  const canonicalVerses = getExistingVerseIds(range);
  if (canonicalVerses.length === 0) notFound();

  if (requestedVerses.length === 0 && requestedOmissions.size === 0) {
    // Deliberately NOT synthesised into a fabricated omission row. We know this edition has no
    // text here; we do not know why, and inventing a manuscript explanation would put a claim
    // about textual transmission on the page that nothing in the corpus supports.
    return (
      <OutsideWorld bookId={firstBookId}><div className="reader-layout">
        <article className="reader">
          <header className="reader__header">
            <h1 className="reader__title">{formatRange(range, books)}</h1>
        {canonLine}
            <TranslationSwitcher
              translations={translations}
              active={translation}
              hrefFor={(code) => `/read/${canonicalReferenceSlug(range, books)}?t=${code}`}
              linkProps={{ replace: true, scroll: false }}
            />
          </header>

          <OutOfScopeNotice
            reference={formatRange(range, books)}
            bookName={book?.name ?? formatRange(range, books)}
            // The book IS in this edition; this reference is not. Naming the book here would be
            // a false statement the reader can disprove with one click on the switcher.
            subject={formatRange(range, books)}
            translationName={translation.name}
            // No scope note: the edition's scope is not the reason, and pasting in "this is a
            // translation of the Hebrew Bible" under a New Testament verse would explain the
            // absence with something that is not the explanation.
            scopeNote=""
            printedBy={getTranslationsPrintingVerse(range.start, translation.translationId)}
            passageSlug={canonicalReferenceSlug(range, books)}
          />

          <footer className="reader__copyright">
            <p>
              <strong>{translation.name}</strong> ({translation.code}).{" "}
              {translation.copyrightNotice}
            </p>
          </footer>
        </article>
      </div></OutsideWorld>
    );
  }

  const chapterCount = getChapterCount(bookId);

  const prevChapter = chapter > 1 ? `${book?.osisId}.${chapter - 1}` : null;
  const nextChapter = chapter < chapterCount ? `${book?.osisId}.${chapter + 1}` : null;

  /**
   * A reference that prints nothing in this translation — `/read/John.5.4?t=BSB` and the other
   * eleven — used to render one apparatus note into an otherwise empty 1280px page. The note
   * is correct and it is the whole answer to the question asked, but a page that is 97% empty
   * reads as a broken page rather than as a short one.
   *
   * The fix is not to pad it with anything invented. It is to show the verses either side, in
   * this translation, clearly marked as context — which is what a printed critical edition does
   * on exactly this page, and which puts the omission back in the sequence that makes it
   * legible: a reader can see that verse 3 runs straight into verse 5.
   *
   * Bounded to the omission's own chapter and to real verses. `getChapterLastVerse` is a query,
   * not arithmetic — inventing an upper bound would ask for verses that do not exist, and the
   * verse-id space is sparse (see AGENTS.md). The endpoints themselves need not be real: both
   * `getPassage` and `getOmissions` are indexed BETWEEN scans over rows that do exist, so a
   * bound that lands in a gap simply matches nothing.
   */
  const CONTEXT_VERSES = 3;
  const contextRange = (() => {
    if (requestedVerses.length > 0) return null;
    const lastInChapter = getChapterLastVerse(bookId, chapter);
    if (lastInChapter === 0) return null;
    const from = Math.max(1, verseOf(range.start) - CONTEXT_VERSES);
    const to = Math.min(lastInChapter, verseOf(range.end) + CONTEXT_VERSES);
    if (to < from) return null;
    return {
      start: toVerseId(bookId, chapter, from),
      end: toVerseId(bookId, chapter, to),
    };
  })();

  // Everything that renders text works from this range; the page's identity (title, permalink,
  // translation switcher) stays the reference the reader actually asked for.
  const renderRange = contextRange ?? range;
  const verses = contextRange
    ? getPassage(contextRange, translation.translationId)
    : requestedVerses;
  const omissionSource = contextRange
    ? getOmissions(contextRange, translation.translationId)
    : requestedOmissions;
  const omissions = [...omissionSource.values()].map((o) => ({
    verseId: o.verseId as number,
    verse: o.verse,
    reason: o.reason,
    history: o.history,
    kind: o.kind,
    printedBy: o.printedBy.map(({ code, name }) => ({ code, name })),
  }));

  // The original-language words under this passage, grouped by canonical verse for the
  // interlinear layer.
  //
  // Loaded unconditionally rather than behind the layer toggle, because the toggle is a CLIENT
  // preference and this is a SERVER render: reading it here would mean either shipping the
  // preference to the server or re-rendering the page whenever it flips, and the second is a
  // full round-trip every time a reader turns the layer on. One indexed BETWEEN scan over a
  // chapter is a few hundred rows — cheaper than the machinery required to avoid it.
  const interlinear = new Map<VerseId, OriginalWord[]>();
  for (const word of getInterlinear(renderRange)) {
    const existing = interlinear.get(word.verseId);
    if (existing) existing.push(word);
    else interlinear.set(word.verseId, [word]);
  }

  // The scribes' own marginal readings (qere), grouped the same way, for the same reason: this
  // is a server render and the `variants` layer toggle lives on the client. Also unconditional
  // for the corpus's own sake — only 1,278 rows exist across the whole Old Testament, so an
  // ordinary chapter's worth of this scan is usually zero rows, not a few hundred.
  const variants = new Map<VerseId, OriginalVariant[]>();
  for (const variant of getOriginalVariants(renderRange)) {
    const existing = variants.get(variant.verseId);
    if (existing) existing.push(variant);
    else variants.set(variant.verseId, [variant]);
  }

  // Curated "windows into the text" (lib/insights/notes.ts), grouped the same way and for the
  // same reason as `variants` above: a server render composing client-toggled layer data.
  const insightNotes = new Map<VerseId, InsightNote[]>();
  for (const note of getInsightNotes(renderRange)) {
    const existing = insightNotes.get(note.verseId);
    if (existing) existing.push(note);
    else insightNotes.set(note.verseId, [note]);
  }

  // The recordings that cover what is on screen (docs/plans/2026-09-04-audio.md). Null when
  // the deployment has no audio artifact at all, in which case nothing below mentions audio.
  // Loaded here, on the server, for the same reason as the interlinear: the corpus and the
  // audio artifact are server-only, and the player component in the shell receives data, never
  // queries it.
  const passageAudio = getPassageAudio(renderRange);
  const audioChoices = availableChoices(passageAudio, translation.code);
  const audioTranslations = translationsWithAudio(passageAudio, translations.map((t) => t.code));
  const wordClips = passageAudio ? getWordClips(renderRange) : undefined;
  const renderedVerseIds = verses.map((v) => v.verseId);
  const { notes: toledotNotes, spans: toledotSpans } = buildToledotNotes(renderRange, renderedVerseIds);

  return (
    <OutsideWorld bookId={firstBookId}><div className="reader-layout">
      <article className="reader">
      <StructuredData data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: `${formatRange(range, books)} · ${translation.name}`,
        url: `https://bible.lucascosolo.com/read/${canonicalReferenceSlug(range, books)}?t=${translation.code}`,
        inLanguage: translation.language,
        description: `Bible text and cross-references for ${formatRange(range, books)} in ${translation.name}.`,
        isPartOf: { "@type": "WebSite", name: "Jot", url: "https://bible.lucascosolo.com/" },
        breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Bible", item: "https://bible.lucascosolo.com/read" },
          { "@type": "ListItem", position: 2, name: book?.name ?? "Book", item: `https://bible.lucascosolo.com/read/${book?.osisId}?t=${translation.code}` },
          { "@type": "ListItem", position: 3, name: formatRange(range, books), item: `https://bible.lucascosolo.com/read/${canonicalReferenceSlug(range, books)}?t=${translation.code}` },
        ] },
      }} />
      <header className="reader__header">
        <h1 className="reader__title">{formatRange(range, books)}</h1>
        {canonLine}

        <div className="reader__header-actions">
          {passageAudio && <ListenButton choices={audioChoices} translationCode={translation.code} />}
          <Link className="reader__pill" href="/notes">
            <NoteIcon className="reader__pill-icon" />
            Notes
          </Link>
          <Link
            className="reader__pill"
            href={compareHref}
          >
            <CompareIcon className="reader__pill-icon" />
            Compare
          </Link>
          <TranslationSwitcher
            translations={translations}
            active={translation}
            // Same path, different query — the reader keeps its exact place.
            hrefFor={(code) => `/read/${canonicalReferenceSlug(range, books)}?t=${code}`}
            linkProps={{ replace: true, scroll: false }}
            withAudio={audioTranslations}
          />
        </div>
      </header>

      {contextRange && (
        // Says exactly what is on screen and no more. The reader asked for one verse, is
        // looking at seven, and must never be left to work out which is which — the apparatus
        // in place explains the omission, and this explains the company it is keeping.
        <p className="reader__context-note">
          {/* "apparatus" is a word from the trade, and this note exists precisely for the reader
              who has just landed on a verse their Bible does not print and needs telling why the
              page looks odd. Plain words, same information. */}
          <strong>{formatRange(range, books)}</strong> is not printed in {translation.name}. The
          verses either side are shown instead, so you can see where it would have fallen — and
          the note in the gap explains why it is missing.
        </p>
      )}

      <PassageRenderer
        verses={verses}
        range={renderRange}
        density="reader"
        translationId={translation.translationId}
        omissions={omissions}
        passageSlug={canonicalReferenceSlug(renderRange, books)}
        // Only the book this range is in: a range spanning more than one book has already
        // resolved to the chapter index above.
        bookLabels={book ? { [bookId]: book.name } : undefined}
        interlinear={interlinear}
        wordClips={wordClips}
        variants={variants}
        insightNotes={insightNotes}
        toledotNotes={toledotNotes}
        toledotSpans={toledotSpans}
        greekEditionVariants={getGreekEditionVariants(renderRange)}
        greekManuscriptReadings={getGreekManuscriptReadings(renderRange)}
      />

      {/* Client-side: selection -> highlight persistence and cross-tab sync (§4.4). Kept
          out of the server-rendered tree above so the passage text itself stays static
          markup that streams without waiting on any client-side data. */}
      {/* `renderRange`, not `range`: the context verses are real, selectable scripture and a
          highlight drawn across them has to resolve against ids that are actually on screen. */}
      <ReaderInteractions
        range={renderRange}
        existingVerseIds={getExistingVerseIds(renderRange)}
        translationId={translation.translationId}
        slug={canonicalReferenceSlug(renderRange, books)}
        label={formatRange(renderRange, books)}
        translationCode={translation.code}
        translations={translations.map(({ translationId, code, name }) => ({
          translationId,
          code,
          name,
        }))}
      />

      {/* The same two destinations as the pager below, bound to the keyboard. Given the hrefs
          rather than computing its own, so the two can never disagree about where "next" is —
          and given `null` at the ends of a book, so a binding that would go nowhere is absent
          rather than silently doing nothing. */}
      <ReaderShortcuts
        prevHref={prevChapter ? `/read/${prevChapter}?t=${translation.code}` : null}
        nextHref={nextChapter ? `/read/${nextChapter}?t=${translation.code}` : null}
      />

      {/* Publishes this page to the player in the shell: which chapters are on screen, which
          recordings exist for them, and where the next chapter is — so a chapter that ends
          turns the page by itself. Same `nextHref` as the pager and the shortcuts, so all
          three agree about where "next" is. */}
      {passageAudio && (
        <ReaderAudio
          passage={{
            slug: canonicalReferenceSlug(renderRange, books),
            label: formatRange(renderRange, books),
            bookName: book?.name ?? formatRange(range, books),
            translationCode: translation.code,
            renderedVerseIds,
            nextHref: nextChapter ? `/read/${nextChapter}?t=${translation.code}` : null,
            audio: passageAudio,
          }}
        />
      )}

      <CrossRefLayer>
        <ReferenceLinks range={range} translationCode={translation.code} />
      </CrossRefLayer>
      <details className="concordance__more">
        <summary>Verse permalinks in {formatRange(range, books)}</summary>
        <nav aria-label="Verse permalinks">
          {canonicalVerses.map((verseId) => {
            const verseRange = { start: verseId, end: verseId };
            return <Link key={verseId} prefetch={false} href={`/read/${canonicalReferenceSlug(verseRange, books)}?t=${translation.code}`}>
              {formatRange(verseRange, books)}{" "}
            </Link>;
          })}
        </nav>
      </details>

      <nav className="reader__pager" aria-label="Chapter navigation">
        {prevChapter ? (
          <Link href={`/read/${prevChapter}?t=${translation.code}`} rel="prev">
            ← {book?.name} {chapter - 1}
          </Link>
        ) : (
          <span />
        )}
        {nextChapter && (
          <Link href={`/read/${nextChapter}?t=${translation.code}`} rel="next">
            {book?.name} {chapter + 1} →
          </Link>
        )}
      </nav>

      {/* Licensors audit for this, and it is a condition of several translation licenses
          that it travel with the text rather than living in a global footer. */}
      <footer className="reader__copyright">
        <p>
          <strong>{translation.name}</strong> ({translation.code}). {translation.copyrightNotice}
        </p>
        {/* The recordings' own credit lines, beside the text's. Two of the four are conditions
            of use (CC BY-SA for the Hebrew reading), and the others name a narrator who gave
            their work away; either way the credit travels with the page it plays on. */}
        {passageAudio &&
          passageAudio.editions
            .filter((e) => passageAudio.chapters.some((c) => c.byEdition[e.code]))
            .map((e) => (
              <p key={e.code} className="reader__audio-credit">
                <strong>Audio:</strong> {e.name}. {e.attribution}{" "}
                <a href={e.sourceUrl} target="_blank" rel="noreferrer noopener">
                  Source
                </a>
                {e.pronunciationNote ? ` ${e.pronunciationNote}` : ""}
              </p>
            ))}
        {/* Beside the licence line on purpose: this is where a reader ends up once they have
            decided to quote something, and it is the one place on the page that already names
            the translation and its terms. */}
        <CiteButton
          path={`/read/${canonicalReferenceSlug(range, books)}?t=${translation.code}`}
          subject={{
            reference: formatRange(range, books),
            translationCode: translation.code,
            translationName: translation.name,
            copyrightNotice: translation.copyrightNotice,
            corpusBuild: getCorpusBuildId(),
          }}
        />
      </footer>
      </article>

      {/* Rendered only when the "Cross-references" layer is on and Selah is off — the branch
          lives in the client wrapper because both are localStorage-backed preferences and this
          page is a server component. */}
      <CrossRefAside
        reference={canonicalReferenceSlug(range, books)}
        translationCode={translation.code}
        translationId={translation.translationId}
      />
    </div></OutsideWorld>
  );
}

/**
 * Timeline notes keyed by the rendered verse they sit under. A link's anchor is an address, and
 * the address space is sparse and a translation may not print every verse, so each note moves
 * to the first verse actually on screen at or after it (a sorted search over the rendered ids,
 * never a walk of the id space). Two links of one subject landing on the same verse stay one note.
 */
function buildToledotNotes(range: VerseRange, renderedVerseIds: readonly VerseId[]) {
  const notes = new Map<VerseId, ToledotNote[]>();
  const spans = new Map<string, string>();
  if (getTimelineBuildId() === null) return { notes, spans };
  const seen = new Set<string>();
  for (const note of getTimelineNotesForRange(range)) {
    let lo = 0;
    let hi = renderedVerseIds.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (renderedVerseIds[mid] < note.anchor) lo = mid + 1;
      else hi = mid;
    }
    const anchor = renderedVerseIds[lo];
    if (anchor === undefined) continue;
    const subjectKey = note.id.slice(0, note.id.lastIndexOf("@"));
    const id = `${subjectKey}@${anchor}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const placed = { ...note, id, anchor };
    const existing = notes.get(anchor);
    if (existing) existing.push(placed);
    else notes.set(anchor, [placed]);
    if (note.start !== note.end) {
      const sameChapter = bookOf(note.start) === bookOf(note.end) && chapterOf(note.start) === chapterOf(note.end);
      spans.set(
        id,
        sameChapter
          ? `verses ${verseOf(note.start)}–${verseOf(note.end)}`
          : `spans ${labelVerses([{ start: note.start, end: note.end, linkType: note.linkType, note: null }])[0].label}`,
      );
    }
  }
  return { notes, spans };
}
