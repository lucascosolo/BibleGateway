"use client";

import Link from "next/link";

/**
 * The place where a translation declines to print a verse.
 *
 * Twelve New Testament verses are absent from the earliest Greek manuscripts. A translation
 * following the critical text skips straight from v.20 to v.22, and a reader who notices the
 * gap has no way to tell scholarship from a broken page. Most Bible software resolves that
 * ambiguity by hiding it — renumbering, or closing the gap silently.
 *
 * We do the opposite. The gap is the apparatus: it is the most legible piece of textual
 * criticism in the corpus and the cheapest possible introduction to the idea that the text
 * has a transmission history at all. So it is rendered, it says why, and it offers the
 * translation that does print the verse — one click, same passage, place preserved.
 */

export interface OmittedVerseNote {
  verseId: number;
  verse: number;
  reason: string;
  history: string;
  printedBy: { code: string; name: string }[];
}

interface OmittedVerseProps {
  note: OmittedVerseNote;
  /** Passage slug of the surrounding view, so the compare link lands on the same place. */
  passageSlug: string;
  /** When false, the note collapses to a single line — the gap is still explained, but the
   *  apparatus detail is suppressed along with every other variant layer. */
  detailed: boolean;
}

export function OmittedVerse({ note, passageSlug, detailed }: OmittedVerseProps) {
  return (
    <aside className="omission" data-verse-id={note.verseId} aria-label={`Verse ${note.verse}, omitted`}>
      <p className="omission__line">
        <span className="omission__number" aria-hidden="true">
          {note.verse}
        </span>
        <span className="omission__label">
          Not printed in this translation
          {!detailed && "."}
        </span>
      </p>

      {detailed && (
        <div className="omission__detail">
          <p>{note.reason}</p>
          <details className="omission__history" open>
            <summary>Where this reading came from and when</summary>
            <p>{note.history}</p>
            <p className="omission__dating-note">
              No surviving manuscript gives an exact date when a reading was added. The dates of
              manuscripts establish evidence for when a reading was already circulating; they do
              not identify a single author or moment of insertion.
            </p>
          </details>
          {note.printedBy.length > 0 && (
            <p>
              Printed in{" "}
              {note.printedBy.map((t, i) => (
                <span key={t.code}>
                  {i > 0 && ", "}
                  <Link href={`/read/${passageSlug}?t=${t.code}#v${note.verseId}`} title={t.name}>
                    {t.code}
                  </Link>
                </span>
              ))}
              .
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
