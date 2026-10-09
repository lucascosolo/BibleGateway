import Link from "next/link";
import { notFound } from "next/navigation";

import { shareMetadata } from "@/app/og/data";
import { CanonNotice } from "@/components/chitzonim/CanonNotice";
import { PassageRenderer } from "@/components/passage/PassageRenderer";
import { Citations } from "@/components/toledot/Citations";
import { EntitySection } from "@/components/toledot/EntityShell";
import { canonNotice, composedLabel, getArea } from "@/lib/chitzonim/outside";
import { getPassage, getTranslationByCode } from "@/lib/db/corpus";
import { getFirstChapter, getOutsideBook } from "@/lib/db/outside";
import { getWork } from "@/lib/db/timeline";
import { toVerseId, type VerseId } from "@/lib/refs";
import { excerpt } from "@/lib/seo";
import { formatRange } from "@/lib/timeline/years";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const work = getWork((await params).id);
  if (!work) notFound();
  return shareMetadata(`${work.title} · Outside books · Jot`, excerpt(work.summary, 200), `/chitzonim/works/${work.id}`, {
    card: { kind: "page", page: "read" },
  });
}

/** The work record above the text, then the opening of the text through the one renderer. */
export default async function WorkPage({ params }: Props) {
  const work = getWork((await params).id);
  if (!work) notFound();
  const area = getArea(work.canon);
  const book = work.bookIds.map(getOutsideBook).find((b) => b && b.translations.length > 0);
  const translation = book ? getTranslationByCode(book.translations[0]) : undefined;
  const chapter = book ? getFirstChapter(book.bookId) : null;
  // Starts at verse 0 so a prologue (Thomas, Sirach) is included; toVerseId rejects 0 by design.
  const range =
    book && chapter !== null ? { start: (toVerseId(book.bookId, chapter, 1) - 1) as VerseId, end: toVerseId(book.bookId, chapter, 999) } : null;
  const verses = range && translation ? getPassage(range, translation.translationId) : [];

  return (
    <div className="outside-page">
      <nav aria-label="Breadcrumb" className="outside-page__crumb">
        <Link href="/chitzonim">Outside books</Link>
        {area && (
          <>
            {" / "}
            <Link href={`/chitzonim/${area.key}`}>{area.title}</Link>
          </>
        )}
      </nav>
      <header className="outside-page__header">
        <h1 className="outside-page__title">{work.title}</h1>
        <p className="outside-page__meta">
          {work.composedEarliest !== null && work.composedLatest !== null ? (
            <>Written <strong>{composedLabel(work.composedEarliest, work.composedLatest, work.composed[0]?.label)}</strong></>
          ) : (
            work.composedUndated ?? "Not dated"
          )}
          {" · "}
          {work.originalLanguage}
          {work.alsoKnownAs.length ? <> · also {work.alsoKnownAs.join(", ")}</> : null}
        </p>
        <CanonNotice notice={canonNotice(work.canon, work.heldCanonicalBy.map((h) => h.tradition))} />
      </header>

      <p className="outside-page__prose">{work.summary}</p>
      <Citations citations={work.citations} />

      {work.composed.length > 0 && (
        <EntitySection title="When it was written">
          <ul className="outside-record">
            {work.composed.map((p) => (
              <li key={p.id}>
                <strong>{p.label}</strong> ({p.earliest === p.latest ? "" : `${formatRange(p.earliest, p.latest)}, `}{p.tradition}). {p.summary}
                <Citations citations={p.citations} />
              </li>
            ))}
          </ul>
        </EntitySection>
      )}

      {work.witnesses.length > 0 && (
        <EntitySection title="What survives">
          <ul className="outside-record">
            {work.witnesses.map((w) => (
              <li key={w.id}>
                <strong>{w.siglum ? `${w.siglum}, ` : ""}{w.name}</strong> ({formatRange(w.earliest, w.latest)}, {w.language})
                {w.institution ? <>, {w.url ? <a href={w.url}>{w.institution}</a> : w.institution}</> : null}
                {w.note ? <>. {w.note}</> : null}
                <Citations citations={w.citations} />
              </li>
            ))}
          </ul>
        </EntitySection>
      )}

      {work.excerpts.length > 0 && (
        <EntitySection title="In its own words">
          {work.excerpts.map((x) => (
            <figure key={x.id} className="outside-excerpt">
              <blockquote>{x.text}</blockquote>
              {x.note && <figcaption>{x.note}</figcaption>}
              <Citations citations={x.citations} />
            </figure>
          ))}
        </EntitySection>
      )}

      {book && range && translation && verses.length > 0 && (
        <EntitySection title={`The text: ${book.name}, opening`}>
          <PassageRenderer
            verses={verses}
            range={range}
            density="reader"
            translationId={translation.translationId}
            passageSlug={`${book.osisId}.${chapter}`}
            bookLabels={{ [book.bookId]: book.name }}
          />
          <p className="outside-page__continue">
            <Link href={`/read/${`${book.osisId}.${chapter}`}?t=${translation.code}`}>
              Continue reading {book.name} in {translation.name}
            </Link>
          </p>
        </EntitySection>
      )}
    </div>
  );
}
