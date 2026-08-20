"use client";

import Link from "next/link";

import type { VerseText } from "@/lib/db/corpus";
import type { VerseOmission } from "@/lib/db/apparatus";
import type { VerseId, VerseRange } from "@/lib/refs/verse-id";
import { PassageRenderer } from "@/components/passage/PassageRenderer";

export interface ParallelTranslation {
  code: string;
  name: string;
  translationId: number;
  verses: VerseText[];
  omissions: Map<number, VerseOmission>;
}

interface ParallelViewProps {
  reference: string;
  readerSlug: string;
  translations: [ParallelTranslation, ParallelTranslation];
  verseIds: VerseId[];
}

function omissionNote(omission: VerseOmission) {
  return {
    verseId: omission.verseId,
    verse: omission.verse,
    reason: omission.reason,
    history: omission.history,
    printedBy: omission.printedBy.map(({ code, name }) => ({ code, name })),
  };
}

/** Verse-aligned comparison: one shared canonical row, two instances of THE renderer. */
export function ParallelView({ reference, readerSlug, translations, verseIds }: ParallelViewProps) {
  const [left, right] = translations;
  const byVerse = (translation: ParallelTranslation) =>
    new Map(translation.verses.map((verse) => [verse.verseId, verse]));

  const leftByVerse = byVerse(left);
  const rightByVerse = byVerse(right);

  return (
    <section className="parallel" aria-labelledby="parallel-title">
      <header className="parallel__header">
        <div>
          <p className="parallel__eyebrow">Verse-aligned comparison</p>
          <h1 id="parallel-title" className="parallel__title">{reference}</h1>
          <p className="parallel__lede">
            Compare translation choices without losing the canonical verse address. On a narrow
            screen, each verse stays together and the editions stack in reading order.
          </p>
        </div>
        <Link className="parallel__back" href={`/read/${readerSlug}`}>
          Back to reader
        </Link>
      </header>

      <div className="parallel__legend" aria-label="Compared translations">
        {[left, right].map((translation) => (
          <div key={translation.code} className="parallel__edition">
            <span className="parallel__code">{translation.code}</span>
            <span>{translation.name}</span>
          </div>
        ))}
      </div>

      <div className="parallel__rows">
        {verseIds.map((verseId) => {
          const leftVerse = leftByVerse.get(verseId);
          const rightVerse = rightByVerse.get(verseId);
          const leftOmission = left.omissions.get(verseId);
          const rightOmission = right.omissions.get(verseId);
          const rowRange = { start: verseId, end: verseId } as VerseRange;

          return (
            <article className="parallel__row" key={verseId} id={`parallel-v${verseId}`}>
              <h2 className="parallel__reference">{leftVerse?.verse ?? rightVerse?.verse ?? ""}</h2>
              <div className="parallel__cell">
                <div className="parallel__cell-label">
                  <span>{left.code}</span><span>{left.name}</span>
                </div>
                <PassageRenderer
                  verses={leftVerse ? [leftVerse] : []}
                  range={rowRange}
                  density="reader"
                  translationId={left.translationId}
                  omissions={leftOmission ? [omissionNote(leftOmission)] : undefined}
                  layerOverrides={{
                    verseNumbers: false,
                    highlights: false,
                    notes: false,
                    crossRefs: false,
                    heat: false,
                    variants: false,
                    sourceCrit: false,
                    interlinear: false,
                  }}
                />
              </div>
              <div className="parallel__cell">
                <div className="parallel__cell-label">
                  <span>{right.code}</span><span>{right.name}</span>
                </div>
                <PassageRenderer
                  verses={rightVerse ? [rightVerse] : []}
                  range={rowRange}
                  density="reader"
                  translationId={right.translationId}
                  omissions={rightOmission ? [omissionNote(rightOmission)] : undefined}
                  layerOverrides={{
                    verseNumbers: false,
                    highlights: false,
                    notes: false,
                    crossRefs: false,
                    heat: false,
                    variants: false,
                    sourceCrit: false,
                    interlinear: false,
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
